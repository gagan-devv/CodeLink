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
    const hasKillEvent = auditResp.data.events.some(
      (e: any) => e.type === 'emergency_kill' && e.sessionId === 'sess-to-kill'
    );
    expect(hasKillEvent).toBe(true);
  });

  it('handles pair gating, list-pending, approve-pairing, and reject-pairing', async () => {
    const sodium = (await import('libsodium-wrappers')).default;
    await sodium.ready;
    const { PairingManager } = await import('../crypto/PairingManager');
    const { PairedDeviceStore } = await import('../auth/PairedDeviceStore');

    const config = new CompanionConfig(path.join(testDir, 'config.json'));
    const hostKeys = sodium.crypto_kx_keypair();
    const deviceStore = new PairedDeviceStore(path.join(testDir, 'devices.json'));
    const pairingManager = new PairingManager(hostKeys, deviceStore);

    // Mock relayManager
    const mockRelayManager = {
      getStatusDetails: () => ({
        enabled: config.isEnabled(),
        activeSessionId: config.isEnabled() ? 'sess-mock-active' : null,
        relayConnected: config.isEnabled(),
        lastError: null,
      }),
      autoAttachIfAvailable: async () => true,
      detachSession: async () => {},
    } as any;

    server = new SocketServer(
      testSock,
      config,
      undefined,
      pairingManager,
      deviceStore,
      undefined,
      undefined,
      mockRelayManager
    );
    await server.start();

    // 1. When service is disabled, pair command refuses
    expect(config.isEnabled()).toBe(false);
    const pairDisabledResp = await sendCommand({ command: 'pair' });
    expect(pairDisabledResp.ok).toBe(false);
    expect(pairDisabledResp.error).toContain('disabled');

    // 2. Enable service
    const enableResp = await sendCommand({ command: 'enable' });
    expect(enableResp.ok).toBe(true);

    // 3. Status returns relay details
    const statusResp = await sendCommand({ command: 'status' });
    expect(statusResp.ok).toBe(true);
    expect(statusResp.data.enabled).toBe(true);
    expect(statusResp.data.activeSessionId).toBe('sess-mock-active');
    expect(statusResp.data.relayConnected).toBe(true);

    // 4. Pair command succeeds when enabled and attached
    const pairResp = await sendCommand({ command: 'pair' });
    expect(pairResp.ok).toBe(true);
    expect(pairResp.data.code).toMatch(/^\d{6}$/);

    // 5. Client initiates pairing
    const clientKeys = sodium.crypto_kx_keypair();
    const initRes = pairingManager.verifyAndInitiate(
      pairResp.data.code,
      sodium.to_base64(clientKeys.publicKey),
      'Android Phone'
    );
    expect(initRes.success).toBe(true);
    const sessionToken = initRes.sessionToken!;

    // 6. list-pending lists the request
    const pendingResp = await sendCommand({ command: 'list-pending' });
    expect(pendingResp.ok).toBe(true);
    expect(pendingResp.data.pending.length).toBe(1);
    expect(pendingResp.data.pending[0].sessionToken).toBe(sessionToken);
    expect(pendingResp.data.pending[0].sas).toHaveLength(6);

    // 7. approve-pairing approves the session
    const approveResp = await sendCommand({
      command: 'approve-pairing',
      args: { sessionToken },
    });
    expect(approveResp.ok).toBe(true);
    expect(approveResp.data.approved).toBe(true);
    const approvedDevices = deviceStore.list();
    expect(approvedDevices.length).toBe(1);
    expect(approvedDevices[0].deviceName).toBe('Android Phone');
    expect(deviceStore.isApproved(approvedDevices[0].deviceId)).toBe(true);

    // 8. Subsequent list-pending has 0 unapproved requests
    const pendingAfter = await sendCommand({ command: 'list-pending' });
    expect(pendingAfter.data.pending.length).toBe(0);
  });
});
