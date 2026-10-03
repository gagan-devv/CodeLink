import { describe, it, expect, afterEach } from 'vitest';
import { SocketServer } from './SocketServer';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { AuditLogger } from '../audit/AuditLogger';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

describe('SocketServer', () => {
  const testDir = path.join(process.cwd(), 'scratch-socket-test');
  const testSock = path.join(testDir, 'test.sock');
  let server: SocketServer | null = null;
  let pty: PtyManager | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    if (fs.existsSync(testSock)) {
      try {
        fs.unlinkSync(testSock);
      } catch {
        // ignore
      }
    }
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  async function sendCommand(cmd: unknown): Promise<{ ok: boolean; data?: any; error?: string }> {
    const client = net.createConnection(testSock);
    const responsePromise = new Promise<string>((resolve) => {
      client.on('data', (d) => resolve(d.toString('utf8')));
    });

    client.write(JSON.stringify(cmd) + '\n');
    const respRaw = await responsePromise;
    client.end();
    return JSON.parse(respRaw);
  }

  it('creates Unix socket with strict 0600 permissions', async () => {
    const config = new CompanionConfig(path.join(testDir, 'config.json'));
    server = new SocketServer(testSock, config);
    await server.start();

    expect(fs.existsSync(testSock)).toBe(true);

    const stat = fs.statSync(testSock);
    // mode & 0777 should be 0600 (read/write for owner only)
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('handles status command over the Unix socket', async () => {
    const config = new CompanionConfig(path.join(testDir, 'config.json'));
    server = new SocketServer(testSock, config);
    await server.start();

    const resp = await sendCommand({ command: 'status' });
    expect(resp.ok).toBe(true);
    expect(resp.data.enabled).toBe(false); // default OFF
  });

  it('handles kill-session and audit commands', async () => {
    const config = new CompanionConfig(path.join(testDir, 'config.json'));
    pty = new PtyManager();
    const auditLogger = new AuditLogger(path.join(testDir, 'audit.log'));
    const sessionTable = new SessionTable(pty, { maxSessions: 8, auditLogger });

    sessionTable.createSession('sess-to-kill', { title: 'Test Session' });
    expect(sessionTable.has('sess-to-kill')).toBe(true);

    server = new SocketServer(
      testSock,
      config,
      sessionTable,
      undefined,
      undefined,
      auditLogger
    );
    await server.start();

    // Kill specific session
    const killResp = await sendCommand({
      command: 'kill-session',
      args: { sessionId: 'sess-to-kill' },
    });
    expect(killResp.ok).toBe(true);
    expect(sessionTable.has('sess-to-kill')).toBe(false);

    // Query audit log
    const auditResp = await sendCommand({
      command: 'audit',
      args: { limit: 10 },
    });
    expect(auditResp.ok).toBe(true);
    expect(Array.isArray(auditResp.data.events)).toBe(true);
    const hasKillEvent = auditResp.data.events.some(
      (e: any) => e.type === 'emergency_kill' && e.sessionId === 'sess-to-kill'
    );
    expect(hasKillEvent).toBe(true);
  });
});
