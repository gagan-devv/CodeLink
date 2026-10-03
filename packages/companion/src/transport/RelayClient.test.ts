import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import sodium from 'libsodium-wrappers';
import { RelayClient } from './RelayClient';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { PairingManager, KeyPair } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { buildTerminalEnvelope, TerminalEnvelope } from '@codelink/protocol';

describe('RelayClient', () => {
  let tempDir: string;
  let configPath: string;
  let config: CompanionConfig;
  let pty: PtyManager;
  let sessionTable: SessionTable;
  let pairingManager: PairingManager;
  let hostKeys: KeyPair;
  let server: http.Server;
  let wss: WebSocketServer;
  let serverPort: number;
  let lastServerWs: WebSocket | null = null;
  let client: RelayClient | null = null;

  beforeEach(async () => {
    await sodium.ready;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelink-relay-client-test-'));
    configPath = path.join(tempDir, 'config.json');

    // Create default config
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        enabled: true,
        maxSessions: 4,
        idleTimeoutMs: 60000,
        recordingEnabled: false,
        ringBufferSizeBytes: 64 * 1024,
        auditLogPath: path.join(tempDir, 'audit.log'),
      })
    );
    config = new CompanionConfig(configPath);
    pty = new PtyManager();
    sessionTable = new SessionTable(pty, { maxSessions: 4 });

    const rawKeys = sodium.crypto_kx_keypair();
    hostKeys = {
      keyType: 'x25519',
      publicKey: rawKeys.publicKey,
      privateKey: rawKeys.privateKey,
    };
    const deviceStore = new PairedDeviceStore(path.join(tempDir, 'devices.json'));
    pairingManager = new PairingManager(hostKeys, deviceStore);

    // Setup fake relay WebSocketServer
    server = http.createServer();
    wss = new WebSocketServer({ server });
    lastServerWs = null;

    wss.on('connection', (ws) => {
      lastServerWs = ws;
      // Send relay handshake ACK
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'HANDSHAKE_ACK',
          payload: { connectionID: 'fake-relay-conn-1' },
        })
      );
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
      client = null;
    }
    if (lastServerWs) {
      lastServerWs.close();
      lastServerWs = null;
    }
    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => resolve());
      });
    });
    await sessionTable.closeAll();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('does nothing when CompanionConfig.enabled is false', async () => {
    config.setEnabled(false);
    let connected = false;

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      onConnected: () => {
        connected = true;
      },
    });

    await client.connect();

    expect(client.isConnected()).toBe(false);
    expect(connected).toBe(false);
    expect(lastServerWs).toBeNull();
  });

  it('connects to relay with token query param when enabled', async () => {
    let receivedUrl = '';
    server.on('upgrade', (req) => {
      receivedUrl = req.url || '';
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'jwt-companion-test-token',
      config,
      sessionTable,
      pairingManager,
    });

    await client.connect();

    expect(client.isConnected()).toBe(true);
    expect(receivedUrl).toContain('token=jwt-companion-test-token');
    expect(client.getRelayConnectionId()).toBe('fake-relay-conn-1');
  });

  it('handles inbound TERM_ATTACH and responds with TERM_ATTACH_RESP', async () => {
    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
    });

    await client.connect();
    expect(lastServerWs).not.toBeNull();

    const attachPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') {
          resolve(parsed);
        }
      });
    });

    // Relay sends TERM_ATTACH from client
    const attachEnvelope = buildTerminalEnvelope('TERM_ATTACH', {
      sessionId: 'test-session-1',
      requestedMode: 'control',
      lastOffset: 0,
    });
    lastServerWs!.send(JSON.stringify(attachEnvelope));

    const resp = await attachPromise;
    expect(resp.type).toBe('TERM_ATTACH_RESP');
    const p = resp.payload as {
      sessionId: string;
      mode: string;
      cols: number;
      rows: number;
      hasGap: boolean;
    };
    expect(p.sessionId).toBe('test-session-1');
    expect(p.mode).toBe('control');
    expect(p.cols).toBeGreaterThan(0);
    expect(p.rows).toBeGreaterThan(0);
    expect(p.hasGap).toBe(false);
  });

  it('handles inbound TERM_INPUT, sends TERM_INPUT_ACK, and streams TERM_OUTPUT', async () => {
    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
    });

    await client.connect();

    // 1. Attach to session first
    const attachPromise = new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') {
          resolve();
        }
      });
    });
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-session-input',
          requestedMode: 'control',
        })
      )
    );
    await attachPromise;

    // 2. Send TERM_INPUT and expect TERM_INPUT_ACK and TERM_OUTPUT
    let ackReceived = false;
    let outputReceived = false;

    const testPromise = new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_INPUT_ACK') {
          const ack = parsed.payload as { inputId: string; generation: number };
          if (ack.inputId === 'cmd-1') {
            ackReceived = true;
          }
        }
        if (parsed.type === 'TERM_OUTPUT') {
          outputReceived = true;
        }
        if (ackReceived && outputReceived) {
          resolve();
        }
      });
    });

    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_INPUT', {
          sessionId: 'test-session-input',
          inputId: 'cmd-1',
          generation: 1,
          data: 'echo "hello from relay test"\n',
        })
      )
    );

    await testPromise;
    expect(ackReceived).toBe(true);
    expect(outputReceived).toBe(true);
  });

  it('deduplicates duplicate TERM_INPUT frames', async () => {
    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
    });

    await client.connect();

    // Attach
    const attachPromise = new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') resolve();
      });
    });
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-session-dedup',
          requestedMode: 'control',
        })
      )
    );
    await attachPromise;

    let ackCount = 0;
    const acksPromise = new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_INPUT_ACK') {
          ackCount++;
          if (ackCount === 2) {
            resolve();
          }
        }
      });
    });

    const inputMsg = JSON.stringify(
      buildTerminalEnvelope('TERM_INPUT', {
        sessionId: 'test-session-dedup',
        inputId: 'dup-input-1',
        generation: 1,
        data: 'ls\n',
      })
    );

    // Send twice
    lastServerWs!.send(inputMsg);
    lastServerWs!.send(inputMsg);

    await acksPromise;
    expect(ackCount).toBe(2);
  });

  it('handles TERM_LIST_SESSIONS and TERM_CLOSE_SESSION', async () => {
    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
    });

    await client.connect();

    // Create session via attach
    const attachPromise = new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') resolve();
      });
    });
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-session-mgmt',
          requestedMode: 'control',
        })
      )
    );
    await attachPromise;

    // List sessions
    const listPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_SESSIONS_LIST') {
          resolve(parsed);
        }
      });
    });

    lastServerWs!.send(
      JSON.stringify(buildTerminalEnvelope('TERM_LIST_SESSIONS', {} as Record<string, never>))
    );

    const listResp = await listPromise;
    expect(listResp.type).toBe('TERM_SESSIONS_LIST');
    const sessions = (listResp.payload as { sessions: Array<{ id: string }> }).sessions;
    expect(sessions.some((s) => s.id === 'test-session-mgmt')).toBe(true);

    // Close session and expect updated sessions list
    const closePromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_SESSIONS_LIST') {
          resolve(parsed);
        }
      });
    });

    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_CLOSE_SESSION', {
          sessionId: 'test-session-mgmt',
        })
      )
    );

    const closeResp = await closePromise;
    expect(closeResp.type).toBe('TERM_SESSIONS_LIST');
    expect(sessionTable.has('test-session-mgmt')).toBe(false);
  });

  it('reconnects with backoff when connection drops unexpectedly', async () => {
    let connectCount = 0;
    const secondConnectPromise = new Promise<void>((resolve) => {
      wss.on('connection', () => {
        connectCount++;
        if (connectCount === 2) {
          resolve();
        }
      });
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      reconnectInitialDelayMs: 50,
      reconnectBackoffFactor: 1.5,
    });

    await client.connect();
    expect(connectCount).toBe(1);

    // Simulate unexpected relay server drop
    lastServerWs!.terminate();

    await secondConnectPromise;
    expect(connectCount).toBe(2);

    // Wait for client-side open event to set isConnected to true
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client?.isConnected()) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });
    expect(client.isConnected()).toBe(true);
  });

  it('stops reconnecting after explicit disconnect()', async () => {
    let connectCount = 0;
    wss.on('connection', () => {
      connectCount++;
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      reconnectInitialDelayMs: 50,
    });

    await client.connect();
    expect(connectCount).toBe(1);

    client.disconnect();
    expect(client.isConnected()).toBe(false);

    // Wait and confirm no additional connections occur
    await new Promise((r) => setTimeout(r, 150));
    expect(connectCount).toBe(1);
  });
});
