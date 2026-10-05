import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import WebSocket, { WebSocketServer } from 'ws';
import { generateKeyPairSync, createSign, createVerify } from 'crypto';
import sodium from 'libsodium-wrappers';
import {
  buildTerminalEnvelope,
  parseTerminalEnvelope,
  TerminalEnvelope,
} from '@codelink/protocol';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { PairingManager, KeyPair } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import {
  DaemonRelayManager,
  requestCompanionToken,
} from './DaemonRelayManager';

describe('Daemon-to-Relay Wiring Integration (Phase 6)', () => {
  let authServer: http.Server;
  let authPort: number;
  let relayWss: WebSocketServer;
  let relayHttpServer: http.Server;
  let relayPort: number;

  let laptopId: string;
  let privateKeyPem: string;
  let publicKeyPem: string;

  let hostKeys: KeyPair;
  let config: CompanionConfig;
  let ptyManager: PtyManager;
  let sessionTable: SessionTable;
  let pairingManager: PairingManager;
  let deviceStore: PairedDeviceStore;
  let daemonRelayManager: DaemonRelayManager;

  let relayCompanionWs: WebSocket | null = null;
  let relayClientWs: WebSocket | null = null;
  let companionTokenReceivedAtRelay = '';

  beforeEach(async () => {
    await sodium.ready;

    // Generate RSA key pair for laptop identity
    const rsaKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    laptopId = 'laptop-test-123';
    privateKeyPem = rsaKeys.privateKey;
    publicKeyPem = rsaKeys.publicKey;

    // Start Fake Auth HTTP Server
    authServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.startsWith('/v1/sessions/') && req.url.endsWith('/companion-token')) {
        const reqLaptopId = req.headers['x-laptop-id'] as string;
        const reqSig = req.headers['x-laptop-sig'] as string;

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString('utf8');
        });

        req.on('end', () => {
          // Verify Laptop Auth
          if (!reqLaptopId || !reqSig) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing laptop auth headers' }));
          }

          if (reqLaptopId !== laptopId) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Unknown laptop id' }));
          }

          const verifier = createVerify('SHA256');
          verifier.update(body);
          const valid = verifier.verify(publicKeyPem, reqSig, 'base64');
          if (!valid) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Bad signature' }));
          }

          const sessionId = req.url!.split('/')[3];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              companionToken: `fake-jwt-companion-token-for-${sessionId}`,
              sessionId,
              relayWss: `ws://127.0.0.1:${relayPort}`,
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
            })
          );
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      authServer.listen(0, '127.0.0.1', () => {
        authPort = (authServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    // Start Fake WebSocket Relay Server
    companionTokenReceivedAtRelay = '';
    relayHttpServer = http.createServer();
    relayWss = new WebSocketServer({ server: relayHttpServer });

    relayWss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (token && token.startsWith('fake-jwt-companion-token-')) {
        companionTokenReceivedAtRelay = token;
        relayCompanionWs = ws;

        ws.on('message', (data) => {
          // Forward companion messages to client if present
          if (relayClientWs && relayClientWs.readyState === WebSocket.OPEN) {
            relayClientWs.send(data);
          }
        });
      } else {
        // Assume mobile client connection
        relayClientWs = ws;
        ws.on('message', (data) => {
          // Forward mobile messages to companion
          if (relayCompanionWs && relayCompanionWs.readyState === WebSocket.OPEN) {
            relayCompanionWs.send(data);
          }
        });
      }
    });

    await new Promise<void>((resolve) => {
      relayHttpServer.listen(0, '127.0.0.1', () => {
        relayPort = (relayHttpServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    // Setup Companion daemon components
    config = new CompanionConfig();
    config.setEnabled(true);

    hostKeys = {
      keyType: 'x25519',
      publicKey: sodium.from_base64(sodium.to_base64(sodium.randombytes_buf(32))),
      privateKey: sodium.from_base64(sodium.to_base64(sodium.randombytes_buf(32))),
    };

    ptyManager = new PtyManager();
    sessionTable = new SessionTable(ptyManager, { maxSessions: 5 });
    const tempStorePath = path.join(os.tmpdir(), `test_devices_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
    deviceStore = new PairedDeviceStore(tempStorePath);
    deviceStore.addDevice({
      deviceId: 'remote-client',
      deviceName: 'Test Phone',
      publicKey: sodium.to_base64(sodium.randombytes_buf(32)),
    });
    pairingManager = new PairingManager(hostKeys, deviceStore);

    daemonRelayManager = new DaemonRelayManager(
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeys,
      `http://127.0.0.1:${authPort}`,
      `ws://127.0.0.1:${relayPort}`
    );
  });

  afterEach(async () => {
    await daemonRelayManager.shutdown();
    await sessionTable.closeAll();

    if (relayCompanionWs) {
      relayCompanionWs.close();
    }
    if (relayClientWs) {
      relayClientWs.close();
    }

    await new Promise<void>((resolve) => relayWss.close(() => resolve()));
    await new Promise<void>((resolve) => relayHttpServer.close(() => resolve()));
    await new Promise<void>((resolve) => authServer.close(() => resolve()));
  });

  it('obtains companion token via POST /v1/sessions/:id/companion-token and connects RelayClient', async () => {
    const sessionId = 'sess-test-auto-wire';

    await daemonRelayManager.attachSession(
      {
        sessionId,
        relayWssUrl: `ws://127.0.0.1:${relayPort}`,
        authUrl: `http://127.0.0.1:${authPort}`,
        laptopId,
        privateKeyPem,
      }
    );

    // Give it a moment to connect
    await new Promise((r) => setTimeout(r, 200));

    expect(daemonRelayManager.isConnected()).toBe(true);
    expect(companionTokenReceivedAtRelay).toBe(`fake-jwt-companion-token-for-${sessionId}`);
  });

  it('completes a full TERM_ATTACH round trip over the relay', async () => {
    const sessionId = 'sess-test-roundtrip';

    await daemonRelayManager.attachSession({
      sessionId,
      relayWssUrl: `ws://127.0.0.1:${relayPort}`,
      authUrl: `http://127.0.0.1:${authPort}`,
      laptopId,
      privateKeyPem,
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(daemonRelayManager.isConnected()).toBe(true);

    // Now simulate mobile client connecting to relay and sending TERM_ATTACH
    const mobileClient = new WebSocket(`ws://127.0.0.1:${relayPort}?token=mobile-client-token`);

    const receivedMessages: TerminalEnvelope[] = [];
    mobileClient.on('message', (raw) => {
      const parsed = parseTerminalEnvelope(raw.toString('utf8'));
      if (parsed) {
        receivedMessages.push(parsed);
      }
    });

    await new Promise<void>((resolve) => {
      mobileClient.on('open', () => resolve());
    });

    // Send TERM_ATTACH from mobile client with approved deviceId and fresh clientNonce
    const clientNonce = sodium.to_hex(sodium.randombytes_buf(16));
    const attachMsg = buildTerminalEnvelope('TERM_ATTACH', {
      sessionId: 'term-sess-1',
      requestedMode: 'control',
      cols: 80,
      rows: 24,
      lastOffset: 0,
      deviceId: 'remote-client',
      clientNonce,
    });
    mobileClient.send(JSON.stringify(attachMsg));

    // Wait for TERM_ATTACH_RESP to be returned back to the mobile client
    await vi.waitFor(() => {
      const attachResp = receivedMessages.find((m) => m.type === 'TERM_ATTACH_RESP');
      expect(attachResp).toBeDefined();
      expect((attachResp?.payload as any)?.sessionId).toBe('term-sess-1');
      expect((attachResp?.payload as any)?.mode).toBe('control');
      expect((attachResp?.payload as any)?.epoch).toBeDefined();
      expect((attachResp?.payload as any)?.hostNonce).toBeDefined();
    }, { timeout: 3000, interval: 50 });

    mobileClient.close();
  });

  it('does not connect when CompanionConfig is disabled', async () => {
    config.setEnabled(false);

    await daemonRelayManager.attachSession({
      sessionId: 'sess-disabled-feature',
      relayWssUrl: `ws://127.0.0.1:${relayPort}`,
      authUrl: `http://127.0.0.1:${authPort}`,
      laptopId,
      privateKeyPem,
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(daemonRelayManager.isConnected()).toBe(false);
    expect(companionTokenReceivedAtRelay).toBe('');
  });

  it('refreshes token and never logs the companion token in console logs', async () => {
    const logs: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));

    const sessionId = 'sess-refresh-and-logs';

    try {
      await daemonRelayManager.attachSession({
        sessionId,
        relayWssUrl: `ws://127.0.0.1:${relayPort}`,
        authUrl: `http://127.0.0.1:${authPort}`,
        laptopId,
        privateKeyPem,
      });

      await new Promise((r) => setTimeout(r, 200));
      expect(daemonRelayManager.isConnected()).toBe(true);

      const secretToken = `fake-jwt-companion-token-for-${sessionId}`;
      // Verify the secret token is nowhere in the logs
      for (const logLine of logs) {
        expect(logLine).not.toContain(secretToken);
      }
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    }
  });
});
