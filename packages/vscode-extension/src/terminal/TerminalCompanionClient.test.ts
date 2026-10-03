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
});
