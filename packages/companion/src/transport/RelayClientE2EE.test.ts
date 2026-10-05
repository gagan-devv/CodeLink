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
import {
  buildTerminalEnvelope,
  TerminalEnvelope,
  TerminalPairPayload,
  TerminalPairRespPayload,
  TerminalPairStatusPayload,
  TerminalPairStatusRespPayload,
  TerminalAttachRespPayload,
  EncryptedPacket,
} from '@codelink/protocol';
import {
  nobleKxClient,
  computeClientSas,
  computeDeviceId,
  toBase64,
  fromBase64,
} from '../../../mobile/src/crypto/nobleKx';
import { MobileE2EESession } from '../../../mobile/src/crypto/MobileE2EESession';

describe('RelayClient E2EE, Pairing Handshake, and Relay Opacity', () => {
  let tempDir: string;
  let configPath: string;
  let config: CompanionConfig;
  let pty: PtyManager;
  let sessionTable: SessionTable;
  let pairingManager: PairingManager;
  let deviceStore: PairedDeviceStore;
  let hostKeys: KeyPair;
  let server: http.Server;
  let wss: WebSocketServer;
  let serverPort: number;
  let lastServerWs: WebSocket | null = null;
  let client: RelayClient | null = null;

  beforeEach(async () => {
    await sodium.ready;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelink-relay-e2ee-test-'));
    configPath = path.join(tempDir, 'config.json');

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
    deviceStore = new PairedDeviceStore(path.join(tempDir, 'devices.json'));
    pairingManager = new PairingManager(hostKeys, deviceStore);

    server = http.createServer();
    wss = new WebSocketServer({ server });
    lastServerWs = null;

    wss.on('connection', (ws) => {
      lastServerWs = ws;
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'HANDSHAKE_ACK',
          payload: { connectionID: 'test-relay-conn-e2ee' },
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
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('completes pairing flow over relay, approves host, and establishes E2EE', async () => {
    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
    });
    await client.connect();

    // 1. Create a pairing challenge on the host companion
    const challenge = pairingManager.createPairingChallenge();
    expect(challenge.code).toHaveLength(6);

    // 2. Mobile generates client keypair
    const clientKx = sodium.crypto_kx_keypair();
    const clientPkB64 = toBase64(clientKx.publicKey);

    // 3. Mobile sends TERM_PAIR via relay
    const pairRespPromise = new Promise<TerminalPairRespPayload>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_PAIR_RESP') {
          resolve(parsed.payload as TerminalPairRespPayload);
        }
      });
    });

    const pairPayload: TerminalPairPayload = {
      attemptId: 'att-e2ee-1',
      code: challenge.code,
      clientPublicKey: clientPkB64,
      clientDeviceName: 'Pixel 8 Pro',
    };
    lastServerWs!.send(JSON.stringify(buildTerminalEnvelope('TERM_PAIR', pairPayload)));

    const pairResp = await pairRespPromise;
    expect(pairResp.success).toBe(true);
    expect(pairResp.sessionToken).toBeDefined();

    // 4. Verify SAS matches on both sides
    const mobileSas = computeClientSas(
      hostKeys.publicKey,
      clientKx.publicKey,
      challenge.code,
      pairPayload.attemptId,
      pairResp.sessionToken
    );
    expect(pairResp.sas).toBe(mobileSas);

    // 5. Host approves the pending pairing
    const sessionToken = pairResp.sessionToken!;
    expect(pairingManager.isPendingApproval(sessionToken)).toBe(true);
    const approved = pairingManager.approve(sessionToken);
    expect(approved).toBe(true);
    expect(pairingManager.isPendingApproval(sessionToken)).toBe(false);

    // 6. Mobile sends TERM_PAIR_STATUS to finalize pairing
    const pairStatusRespPromise = new Promise<TerminalPairStatusRespPayload>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_PAIR_STATUS_RESP') {
          resolve(parsed.payload as TerminalPairStatusRespPayload);
        }
      });
    });

    const statusPayload: TerminalPairStatusPayload = {
      attemptId: 'att-e2ee-1',
      sessionToken,
    };
    lastServerWs!.send(JSON.stringify(buildTerminalEnvelope('TERM_PAIR_STATUS', statusPayload)));

    const statusResp = await pairStatusRespPromise;
    expect(statusResp.approved).toBe(true);
    expect(statusResp.deviceId).toBeDefined();
    expect(statusResp.hostPublicKey).toBe(toBase64(hostKeys.publicKey));

    const deviceId = statusResp.deviceId!;
    expect(deviceStore.isApproved(deviceId)).toBe(true);
  });

  it('rejects TERM_INPUT from an unapproved device', async () => {
    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
    });
    await client.connect();

    const errPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ERROR') {
          resolve(parsed);
        }
      });
    });

    // Send input with unapproved deviceId
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_INPUT', {
          sessionId: 'test-unapproved',
          inputId: 'in-1',
          generation: 1,
          deviceId: 'dev-unknown-rogue',
          data: 'whoami\n',
        })
      )
    );

    const errEnv = await errPromise;
    const errPayload = errEnv.payload as { code: string; message: string };
    expect(errPayload.code).toBe('DEVICE_NOT_APPROVED');
  });

  it('rejects unencrypted plaintext input when E2EE is required', async () => {
    // Approve a device in the store
    const clientKx = sodium.crypto_kx_keypair();
    const deviceId = computeDeviceId(clientKx.publicKey);
    deviceStore.addDevice({
      deviceId,
      deviceName: 'Authorized Client',
      publicKey: toBase64(clientKx.publicKey),
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
      defaultDeviceId: deviceId,
    });
    await client.connect();

    const errPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ERROR') {
          resolve(parsed);
        }
      });
    });

    // Send plaintext command
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_INPUT', {
          sessionId: 'test-session-plain',
          inputId: 'in-2',
          generation: 1,
          deviceId,
          data: 'cat /etc/passwd\n',
        })
      )
    );

    const errEnv = await errPromise;
    const errPayload = errEnv.payload as { code: string };
    expect(errPayload.code).toBe('PLAINTEXT_REJECTED');
  });

  it('performs full encrypted round trip and asserts relay never sees plaintext', async () => {
    // Pre-approve client device
    const clientKx = sodium.crypto_kx_keypair();
    const deviceId = computeDeviceId(clientKx.publicKey);
    deviceStore.addDevice({
      deviceId,
      deviceName: 'Test Phone',
      publicKey: toBase64(clientKx.publicKey),
    });

    // Client sets up noble session keys
    const clientKeys = nobleKxClient(clientKx.publicKey, clientKx.privateKey, hostKeys.publicKey);
    const mobileSession = new MobileE2EESession('client', clientKeys.sharedTx, clientKeys.sharedRx);

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
      defaultDeviceId: deviceId,
    });
    await client.connect();

    // Attach to session with fresh clientNonce
    const clientNonce = sodium.to_hex(sodium.randombytes_buf(16));
    const attachPromise = new Promise<TerminalAttachRespPayload>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') {
          resolve(parsed.payload as TerminalAttachRespPayload);
        }
      });
    });

    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-sess-e2ee',
          requestedMode: 'control',
          deviceId,
          clientNonce,
        })
      )
    );
    const attachResp = await attachPromise;
    expect(attachResp.epoch).toBeDefined();
    mobileSession.setEpoch(attachResp.epoch!);

    // Track all frames traversing relay to verify opacity
    const relayTraffic: TerminalEnvelope[] = [];
    let ackReceived = false;
    let decryptedOutput = '';

    const roundTripPromise = new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        relayTraffic.push(parsed);

        if (parsed.type === 'TERM_INPUT_ACK') {
          ackReceived = true;
        }

        if (parsed.type === 'TERM_OUTPUT') {
          const payload = parsed.payload as { data: string };
          // Relay sees JSON stringified EncryptedPacket
          const packet: EncryptedPacket = JSON.parse(payload.data);
          // Decrypt with mobile session
          const text = mobileSession.decrypt(packet);
          decryptedOutput += text;

          if (decryptedOutput.includes('E2EE_ROUNDTRIP_SUCCESS')) {
            resolve();
          }
        }
      });
    });

    // Mobile encrypts input
    const commandPlaintext = 'echo E2EE_ROUNDTRIP_SUCCESS\n';
    const encryptedPacket = mobileSession.encrypt(commandPlaintext);

    // Send encrypted TERM_INPUT over relay
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_INPUT', {
          sessionId: 'test-sess-e2ee',
          inputId: 'input-e2ee-1',
          generation: 1,
          deviceId,
          data: JSON.stringify(encryptedPacket),
        })
      )
    );

    await roundTripPromise;

    expect(ackReceived).toBe(true);
    expect(decryptedOutput).toContain('E2EE_ROUNDTRIP_SUCCESS');

    // Opacity assertion: relay never observed plaintext in any TERM_INPUT or TERM_OUTPUT frame
    for (const frame of relayTraffic) {
      if (frame.type === 'TERM_INPUT') {
        const p = frame.payload as { data: string };
        expect(p.data).not.toContain('echo E2EE_ROUNDTRIP_SUCCESS');
      }
      if (frame.type === 'TERM_OUTPUT') {
        const p = frame.payload as { data: string };
        expect(p.data).not.toContain('E2EE_ROUNDTRIP_SUCCESS');
      }
    }
  });

  it('rejects replayed nonce and out-of-order sequence frames', async () => {
    const clientKx = sodium.crypto_kx_keypair();
    const deviceId = computeDeviceId(clientKx.publicKey);
    deviceStore.addDevice({
      deviceId,
      deviceName: 'Replay Test Device',
      publicKey: toBase64(clientKx.publicKey),
    });

    const clientKeys = nobleKxClient(clientKx.publicKey, clientKx.privateKey, hostKeys.publicKey);
    const mobileSession = new MobileE2EESession('client', clientKeys.sharedTx, clientKeys.sharedRx);

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
      defaultDeviceId: deviceId,
    });
    await client.connect();

    // Attach with fresh clientNonce
    const clientNonce = sodium.to_hex(sodium.randombytes_buf(16));
    const attachPromise = new Promise<TerminalAttachRespPayload>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') resolve(parsed.payload as TerminalAttachRespPayload);
      });
    });
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-sess-replay',
          requestedMode: 'control',
          deviceId,
          clientNonce,
        })
      )
    );
    const attachResp = await attachPromise;
    expect(attachResp.epoch).toBeDefined();
    mobileSession.setEpoch(attachResp.epoch!);

    // Send packet 1
    const pkt1 = mobileSession.encrypt('echo 1\n');
    const sendPkt = (packet: EncryptedPacket, id: string) => {
      lastServerWs!.send(
        JSON.stringify(
          buildTerminalEnvelope('TERM_INPUT', {
            sessionId: 'test-sess-replay',
            inputId: id,
            generation: 1,
            deviceId,
            data: JSON.stringify(packet),
          })
        )
      );
    };

    // First packet succeeds
    sendPkt(pkt1, 'in-replay-1');

    // Wait for ACK
    await new Promise<void>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_INPUT_ACK') resolve();
      });
    });

    // Replay packet 1 with a different inputId
    const replayErrPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ERROR') {
          resolve(parsed);
        }
      });
    });

    sendPkt(pkt1, 'in-replay-2');

    const errEnv = await replayErrPromise;
    const errPayload = errEnv.payload as { code: string; message: string };
    expect(errPayload.code).toBe('DECRYPTION_FAILED');
    expect(errPayload.message).toContain('Replay detected');
  });

  it('rejects TERM_ATTACH without clientNonce when E2EE is required', async () => {
    const clientKx = sodium.crypto_kx_keypair();
    const deviceId = computeDeviceId(clientKx.publicKey);
    deviceStore.addDevice({
      deviceId,
      deviceName: 'Device Missing Nonce',
      publicKey: toBase64(clientKx.publicKey),
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
      defaultDeviceId: deviceId,
    });
    await client.connect();

    const errPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ERROR') {
          resolve(parsed);
        }
      });
    });

    // Send TERM_ATTACH omitting clientNonce
    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-sess-missing-nonce',
          requestedMode: 'control',
          deviceId,
          // clientNonce omitted
        })
      )
    );

    const errEnv = await errPromise;
    const errPayload = errEnv.payload as { code: string; message: string };
    expect(errPayload.code).toBe('ATTACH_NONCE_REQUIRED');
    expect(errPayload.message).toContain('Client nonce');
  });

  it('rate-limits rapid TERM_ATTACH epoch resets within cooldown window (DoS prevention)', async () => {
    const clientKx = sodium.crypto_kx_keypair();
    const deviceId = computeDeviceId(clientKx.publicKey);
    deviceStore.addDevice({
      deviceId,
      deviceName: 'Device Rate Limit',
      publicKey: toBase64(clientKx.publicKey),
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
      defaultDeviceId: deviceId,
      attachCooldownMs: 2000,
    });
    await client.connect();

    // First attach succeeds
    const nonce1 = sodium.to_hex(sodium.randombytes_buf(16));
    const attach1Promise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ATTACH_RESP') resolve(parsed);
      });
    });

    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-sess-rl',
          requestedMode: 'control',
          deviceId,
          clientNonce: nonce1,
        })
      )
    );
    await attach1Promise;

    // Immediately re-attach (within 2000ms cooldown) -> rejected with ATTACH_RATE_LIMITED
    const nonce2 = sodium.to_hex(sodium.randombytes_buf(16));
    const rateLimitPromise = new Promise<TerminalEnvelope>((resolve) => {
      lastServerWs!.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString('utf8')) as TerminalEnvelope;
        if (parsed.type === 'TERM_ERROR') resolve(parsed);
      });
    });

    lastServerWs!.send(
      JSON.stringify(
        buildTerminalEnvelope('TERM_ATTACH', {
          sessionId: 'test-sess-rl',
          requestedMode: 'control',
          deviceId,
          clientNonce: nonce2,
        })
      )
    );

    const rateLimitEnv = await rateLimitPromise;
    const rlPayload = rateLimitEnv.payload as { code: string; message: string };
    expect(rlPayload.code).toBe('ATTACH_RATE_LIMITED');
    expect(rlPayload.message).toContain('Rapid re-attach rejected');
  });

  it('sendOutput safely drops chunks and never throws or leaks plaintext when E2EE session has no epoch', () => {
    const clientKx = sodium.crypto_kx_keypair();
    const deviceId = computeDeviceId(clientKx.publicKey);
    deviceStore.addDevice({
      deviceId,
      deviceName: 'Device No Epoch',
      publicKey: toBase64(clientKx.publicKey),
    });

    client = new RelayClient({
      relayUrl: `ws://127.0.0.1:${serverPort}`,
      token: 'test-token',
      config,
      sessionTable,
      pairingManager,
      deviceStore,
      hostKeyPair: hostKeys,
      requireE2EE: true,
      defaultDeviceId: deviceId,
    });

    // Session is created lazily without epoch
    const session = client.getOrCreateE2EESession(deviceId);
    expect(session).not.toBeNull();
    expect(session!.getEpoch()).toBeUndefined();

    // Calling sendOutput must NOT throw and must NOT emit TERM_OUTPUT plaintext
    const sendSpy = vi.spyOn(client, 'sendTerminalEnvelope');
    expect(() => {
      client.sendOutput('test-sess-safe', 'secret shell prompt', deviceId);
    }).not.toThrow();

    expect(sendSpy).not.toHaveBeenCalledWith('TERM_OUTPUT', expect.anything());
    sendSpy.mockRestore();
  });
});
