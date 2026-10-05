import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TerminalCompanionClient } from './TerminalCompanionClient';

describe('TerminalCompanionClient', () => {
  let tempDir: string;
  let socketPath: string;
  let mockServer: net.Server | null = null;
  let client: TerminalCompanionClient;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelink-ext-socket-'));
    socketPath = path.join(tempDir, 'terminal.sock');
    client = new TerminalCompanionClient(socketPath);
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
      mockServer = null;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detects when companion daemon is not running', async () => {
    const isAvail = await client.isDaemonAvailable();
    expect(isAvail).toBe(false);

    await expect(client.getStatus()).rejects.toThrow(/companion daemon is not running/i);
  });

  it('queries status from companion daemon over Unix socket', async () => {
    mockServer = net.createServer((socket) => {
      socket.on('data', () => {
        const response = {
          ok: true,
          data: {
            enabled: true,
            recordingEnabled: false,
            maxSessions: 8,
            activeSessions: 2,
            uptimeSeconds: 120,
          },
        };
        socket.write(JSON.stringify(response) + '\n');
      });
    });

    await new Promise<void>((resolve) => mockServer!.listen(socketPath, () => resolve()));

    const isAvail = await client.isDaemonAvailable();
    expect(isAvail).toBe(true);

    const status = await client.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.activeSessions).toBe(2);
  });

  it('sends takeover command and processes response', async () => {
    mockServer = net.createServer((socket) => {
      let buf = '';
      socket.on('data', (d) => {
        buf += d.toString('utf8');
        if (buf.includes('\n')) {
          const cmd = JSON.parse(buf.trim());
          if (cmd.command === 'takeover' && cmd.args?.sessionId === 'sess-42') {
            socket.write(
              JSON.stringify({ ok: true, data: { message: 'Reclaimed control of session sess-42' } }) +
                '\n'
            );
          }
        }
      });
    });

    await new Promise<void>((resolve) => mockServer!.listen(socketPath, () => resolve()));

    const res = await client.takeoverSession('sess-42');
    expect(res.ok).toBe(true);
  });

  it('sends kill-session command and processes response', async () => {
    mockServer = net.createServer((socket) => {
      let buf = '';
      socket.on('data', (d) => {
        buf += d.toString('utf8');
        if (buf.includes('\n')) {
          const cmd = JSON.parse(buf.trim());
          if (cmd.command === 'kill-session' && cmd.args?.sessionId === 'sess-99') {
            socket.write(
              JSON.stringify({ ok: true, data: { message: 'Terminated session sess-99' } }) + '\n'
            );
          }
        }
      });
    });

    await new Promise<void>((resolve) => mockServer!.listen(socketPath, () => resolve()));

    const res = await client.killSession('sess-99');
    expect(res.ok).toBe(true);
  });

  it('supports pairing challenge creation, listing pending, approving, and rejecting', async () => {
    mockServer = net.createServer((socket) => {
      let buf = '';
      socket.on('data', (d) => {
        buf += d.toString('utf8');
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const cmd = JSON.parse(line.trim());
          if (cmd.command === 'pair') {
            socket.write(
              JSON.stringify({
                ok: true,
                data: {
                  code: '123456',
                  fingerprint: 'abcd1234abcd1234',
                  qrPayload: 'mock-qr',
                  expiresAt: Date.now() + 300000,
                  activeSessionId: 'sess-test',
                  relayConnected: true,
                },
              }) + '\n'
            );
          } else if (cmd.command === 'list-pending') {
            socket.write(
              JSON.stringify({
                ok: true,
                data: {
                  pending: [
                    {
                      sessionToken: 'token-abc',
                      clientDeviceName: 'Pixel 8',
                      fingerprint: 'fp-1234',
                      sas: 'ABCD-EF01-2345',
                      createdAt: Date.now(),
                      expiresAt: Date.now() + 300000,
                    },
                  ],
                },
              }) + '\n'
            );
          } else if (cmd.command === 'approve-pairing' && cmd.args?.sessionToken === 'token-abc') {
            socket.write(
              JSON.stringify({
                ok: true,
                data: { approved: true, sessionToken: 'token-abc' },
              }) + '\n'
            );
          } else if (cmd.command === 'reject-pairing' && cmd.args?.sessionToken === 'token-abc') {
            socket.write(
              JSON.stringify({
                ok: true,
                data: { rejected: true, sessionToken: 'token-abc' },
              }) + '\n'
            );
          }
        }
      });
    });

    await new Promise<void>((resolve) => mockServer!.listen(socketPath, () => resolve()));

    const challenge = await client.createPairingChallenge();
    expect(challenge.code).toBe('123456');
    expect(challenge.relayConnected).toBe(true);

    const pending = await client.listPendingPairings();
    expect(pending.length).toBe(1);
    expect(pending[0].sas).toBe('ABCD-EF01-2345');
    expect(pending[0].clientDeviceName).toBe('Pixel 8');

    const approveRes = await client.approvePairing('token-abc');
    expect(approveRes.ok).toBe(true);

    const rejectRes = await client.rejectPairing('token-abc');
    expect(rejectRes.ok).toBe(true);
  });
});
