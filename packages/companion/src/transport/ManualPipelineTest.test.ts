import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import WebSocket, { WebSocketServer } from 'ws';
import { generateKeyPairSync } from 'crypto';
import sodium from 'libsodium-wrappers';
import {
  buildTerminalEnvelope,
  parseTerminalEnvelope,
  TerminalEnvelope,
  TerminalOutputPayload,
} from '@codelink/protocol';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { PairingManager, KeyPair } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { E2EESession, EncryptedPacket } from '../crypto/E2EESession';
import { DaemonRelayManager } from './DaemonRelayManager';

describe('Manual E2E Pipeline: Client -> Relay -> Companion -> PTY -> Client', () => {
  let authServer: http.Server;
  let authPort: number;
  let relayWss: WebSocketServer;
  let relayHttpServer: http.Server;
  let relayPort: number;

  let laptopId: string;
  let privateKeyPem: string;
  let hostKeys: KeyPair;
  let config: CompanionConfig;
  let ptyManager: PtyManager;
  let sessionTable: SessionTable;
  let pairingManager: PairingManager;
  let deviceStore: PairedDeviceStore;
  let daemonRelayManager: DaemonRelayManager;

  let relayCompanionWs: WebSocket | null = null;
  let relayClientWs: WebSocket | null = null;

  beforeEach(async () => {
    await sodium.ready;

    const rsaKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    laptopId = 'laptop-manual-test';
    privateKeyPem = rsaKeys.privateKey;

    // Fake Auth Server
    authServer = http.createServer((req, res) => {
      const sessionId = req.url?.split('/')[3] || 'manual-session';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          companionToken: `manual-token-for-${sessionId}`,
          sessionId,
          relayWss: `ws://127.0.0.1:${relayPort}`,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        })
      );
    });

    await new Promise<void>((resolve) => {
      authServer.listen(0, '127.0.0.1', () => {
        authPort = (authServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    // Fake Relay Server
    relayHttpServer = http.createServer();
    relayWss = new WebSocketServer({ server: relayHttpServer });

    relayWss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (token && token.startsWith('manual-token-')) {
        relayCompanionWs = ws;
        ws.on('message', (data) => {
          if (relayClientWs && relayClientWs.readyState === WebSocket.OPEN) {
            relayClientWs.send(data);
          }
        });
      } else {
        relayClientWs = ws;
        ws.on('message', (data) => {
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

    config = new CompanionConfig();
    config.setEnabled(true);

    const rawHostKeys = sodium.crypto_kx_keypair();
    hostKeys = {
      keyType: 'x25519',
      publicKey: rawHostKeys.publicKey,
      privateKey: rawHostKeys.privateKey,
    };

    ptyManager = new PtyManager();
    sessionTable = new SessionTable(ptyManager, { maxSessions: 5 });

    const tempStorePath = path.join(
      os.tmpdir(),
      `manual_devices_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
    );
    deviceStore = new PairedDeviceStore(tempStorePath);
    const phoneKeys = sodium.crypto_kx_keypair();
    deviceStore.addDevice({
      deviceId: 'mobile-phone-1',
      deviceName: 'Gagan Phone',
      publicKey: sodium.to_base64(phoneKeys.publicKey),
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

    (globalThis as any).__testPhoneKeys = phoneKeys;
  });

  afterEach(async () => {
    if (daemonRelayManager) {
      await daemonRelayManager.shutdown();
    }
    if (sessionTable) {
      await sessionTable.closeAll();
    }
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

  it('runs complete flow: phone connects -> attaches to session -> sends input to real PTY -> PTY executes -> output flows back to phone', async () => {
    const sessionId = 'manual-pty-session';
    const phoneKeys = (globalThis as any).__testPhoneKeys;
    const clientKx = sodium.crypto_kx_client_session_keys(
      phoneKeys.publicKey,
      phoneKeys.privateKey,
      hostKeys.publicKey
    );
    const phoneE2EESession = new E2EESession('client', clientKx.sharedTx, clientKx.sharedRx);

    // 1. Companion attaches session
    await daemonRelayManager.attachSession({
      sessionId,
      relayWssUrl: `ws://127.0.0.1:${relayPort}`,
      authUrl: `http://127.0.0.1:${authPort}`,
      laptopId,
      privateKeyPem,
    });

    await vi.waitFor(() => {
      expect(daemonRelayManager.isConnected()).toBe(true);
    }, { timeout: 2000 });

    // 2. Mobile phone connects to relay
    const phoneWs = new WebSocket(`ws://127.0.0.1:${relayPort}?token=phone-client-jwt`);
    await new Promise<void>((resolve) => phoneWs.on('open', () => resolve()));

    const receivedOutputs: string[] = [];
    let attachRespReceived = false;

    phoneWs.on('message', (raw) => {
      const envelope = parseTerminalEnvelope(raw.toString('utf8'));
      if (!envelope) return;

      if (envelope.type === 'TERM_ATTACH_RESP') {
        attachRespReceived = true;
      } else if (envelope.type === 'TERM_OUTPUT') {
        const payload = envelope.payload as TerminalOutputPayload;
        try {
          const packet = JSON.parse(payload.data) as EncryptedPacket;
          const decrypted = phoneE2EESession.decrypt(packet);
          receivedOutputs.push(decrypted);
        } catch {
          receivedOutputs.push(payload.data);
        }
      }
    });

    // 3. Phone sends TERM_ATTACH
    const attachEnvelope = buildTerminalEnvelope('TERM_ATTACH', {
      sessionId: 'sess-terminal-pty',
      requestedMode: 'control',
      cols: 80,
      rows: 24,
      lastOffset: 0,
      deviceId: 'mobile-phone-1',
    } as any);
    phoneWs.send(JSON.stringify(attachEnvelope));

    // Wait for attach response
    await vi.waitFor(() => {
      expect(attachRespReceived).toBe(true);
    }, { timeout: 3000 });

    // 4. Phone sends encrypted shell command input to real PTY
    const testSecret = 'CODELINK_MANUAL_E2E_VERIFIED_9876';
    const encryptedInput = phoneE2EESession.encrypt(`echo "${testSecret}"\n`);
    const inputEnvelope = buildTerminalEnvelope('TERM_INPUT', {
      sessionId: 'sess-terminal-pty',
      data: JSON.stringify(encryptedInput),
      deviceId: 'mobile-phone-1',
      generation: 1,
    } as any);
    phoneWs.send(JSON.stringify(inputEnvelope));

    // 5. Verify PTY execution output flows back through Relay to the Phone
    await vi.waitFor(() => {
      const allText = receivedOutputs.join('');
      expect(allText).toContain(testSecret);
    }, { timeout: 5000, interval: 100 });

    phoneWs.close();
  });
});
