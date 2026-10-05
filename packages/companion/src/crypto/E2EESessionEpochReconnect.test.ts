import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import sodium from 'libsodium-wrappers';
import { E2EESession, computeEpoch } from './E2EESession';
import { PairingManager, KeyPair } from './PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { RelayClient } from '../transport/RelayClient';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { MobileE2EESession } from '../../../mobile/src/crypto/MobileE2EESession';
import {
  nobleKxClient,
  nobleKxServer,
  computeClientSas,
  computeApprovalProof,
  toHex,
  fromHex,
} from '../../../mobile/src/crypto/nobleKx';

describe('FIX 1: Connection Epoch Reconnect & Restore Lifecycle', () => {
  let hostKeyPair: KeyPair;
  let deviceStore: PairedDeviceStore;

  beforeAll(async () => {
    await sodium.ready;
    const kx = sodium.crypto_kx_keypair();
    hostKeyPair = {
      keyType: 'x25519',
      publicKey: kx.publicKey,
      privateKey: kx.privateKey,
    };
  });

  beforeEach(() => {
    deviceStore = new PairedDeviceStore();
  });

  it('refuses to accept or send packets if no connection epoch is established', () => {
    const dummyKey = new Uint8Array(32);
    const hostSession = new E2EESession('host', dummyKey, dummyKey);
    const mobileSession = new MobileE2EESession('client', dummyKey, dummyKey);

    expect(hostSession.getEpoch()).toBeUndefined();
    expect(mobileSession.getEpoch()).toBeUndefined();

    // Encrypt must throw
    expect(() => hostSession.encrypt('hello')).toThrow(/cannot encrypt without established epoch/);
    expect(() => mobileSession.encrypt('hello')).toThrow(/cannot encrypt without established epoch/);

    // Decrypt must throw
    const dummyPacket = { seq: 1, nonce: 'AAAA', ciphertext: 'BBBB' };
    expect(() => hostSession.decrypt(dummyPacket)).toThrow(/cannot decrypt without established epoch/);
    expect(() => mobileSession.decrypt(dummyPacket)).toThrow(/cannot decrypt without established epoch/);
  });

  it('(a) pairs, restarts mobile (restored session without epoch), and establishes fresh epoch on attach', async () => {
    const config = new CompanionConfig();
    config.setEnabled(true);
    const ptyManager = new PtyManager();
    const sessionTable = new SessionTable(ptyManager);
    const pm = new PairingManager(hostKeyPair, deviceStore);

    const relayClient = new RelayClient({
      relayUrl: 'ws://127.0.0.1:9999',
      token: 'fake-token',
      config,
      sessionTable,
      pairingManager: pm,
      deviceStore,
      hostKeyPair,
      requireE2EE: true,
      attachCooldownMs: 0,
    });

    // 1. Initial pairing
    const clientKp = sodium.crypto_kx_keypair();
    const challenge = pm.createPairingChallenge();
    const initRes = pm.verifyAndInitiate(
      challenge.code,
      sodium.to_base64(clientKp.publicKey),
      'Mobile Phone',
      'attempt-init-1'
    );
    expect(initRes.success).toBe(true);

    // Host approves pairing
    expect(pm.approve(initRes.sessionToken!)).toBe(true);

    // Poll status: host companion registers approved device and creates host session
    let pairStatusResp: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_PAIR_STATUS_RESP') pairStatusResp = payload;
    });

    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-1',
        ts: Date.now(),
        seq: 1,
        type: 'TERM_PAIR_STATUS',
        payload: { attemptId: 'attempt-init-1', sessionToken: initRes.sessionToken! },
      })
    );

    expect(pairStatusResp.approved).toBe(true);
    const deviceId = pairStatusResp.deviceId;

    // Mobile derives client keys and instantiates session (initially without epoch)
    const clientKeys = nobleKxClient(
      clientKp.publicKey,
      clientKp.privateKey,
      hostKeyPair.publicKey
    );
    const mobileSession = new MobileE2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx
    );
    expect(mobileSession.getEpoch()).toBeUndefined();

    // 2. Mobile attaches: exchanges clientNonce (16 bytes) and gets hostNonce -> Epoch 1
    const clientNonce1 = sodium.to_hex(sodium.randombytes_buf(16));
    let attachResp1: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_ATTACH_RESP') attachResp1 = payload;
    });

    sessionTable.createSession('session-alpha');
    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-2',
        ts: Date.now(),
        seq: 2,
        type: 'TERM_ATTACH',
        payload: {
          sessionId: 'session-alpha',
          requestedMode: 'control',
          deviceId,
          clientNonce: clientNonce1,
        },
      })
    );

    expect(attachResp1).not.toBeNull();
    expect(attachResp1.hostNonce).toBeDefined();
    expect(attachResp1.epoch).toBeDefined();

    // Both derive Epoch 1
    const expectedEpoch1 = computeEpoch(clientNonce1, attachResp1.hostNonce);
    expect(attachResp1.epoch).toBe(expectedEpoch1);
    mobileSession.setEpoch(expectedEpoch1);

    // Communicate in Epoch 1: Mobile encrypts input, host decrypts
    const packet1 = mobileSession.encrypt('echo hello-epoch-1\n');
    let inputAck: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_INPUT_ACK') inputAck = payload;
    });

    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-3',
        ts: Date.now(),
        seq: 3,
        type: 'TERM_INPUT',
        payload: {
          sessionId: 'session-alpha',
          inputId: 'input-1',
          generation: 1,
          data: JSON.stringify(packet1),
          deviceId,
        },
      })
    );
    expect(inputAck).not.toBeNull();

    // 3. Mobile "Restarts": restores session from persistent storage
    // restoreSessionIfPaired() builds a fresh session without epoch
    const restoredMobileSession = new MobileE2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx
    );
    expect(restoredMobileSession.getEpoch()).toBeUndefined();
    expect(() => restoredMobileSession.encrypt('fail')).toThrow(/cannot encrypt without established epoch/);

    // Mobile re-attaches with a fresh random clientNonce -> Epoch 2
    const clientNonce2 = sodium.to_hex(sodium.randombytes_buf(16));
    expect(clientNonce2).not.toBe(clientNonce1);

    let attachResp2: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_ATTACH_RESP') attachResp2 = payload;
    });

    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-4',
        ts: Date.now(),
        seq: 4,
        type: 'TERM_ATTACH',
        payload: {
          sessionId: 'session-alpha',
          requestedMode: 'control',
          deviceId,
          clientNonce: clientNonce2,
        },
      })
    );

    expect(attachResp2).not.toBeNull();
    const expectedEpoch2 = computeEpoch(clientNonce2, attachResp2.hostNonce);
    expect(attachResp2.epoch).toBe(expectedEpoch2);
    expect(expectedEpoch2).not.toBe(expectedEpoch1);

    restoredMobileSession.setEpoch(expectedEpoch2);

    // 4. Talk cleanly in Epoch 2
    const packet2 = restoredMobileSession.encrypt('echo hello-epoch-2\n');
    expect(packet2.seq).toBe(1); // sequence counter reset safely with new epoch!
    expect(packet2.epoch).toBe(expectedEpoch2);

    let inputAck2: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_INPUT_ACK') inputAck2 = payload;
    });

    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-5',
        ts: Date.now(),
        seq: 5,
        type: 'TERM_INPUT',
        payload: {
          sessionId: 'session-alpha',
          inputId: 'input-2',
          generation: 1,
          data: JSON.stringify(packet2),
          deviceId,
        },
      })
    );
    expect(inputAck2).not.toBeNull();
  });

  it('(b) restarts daemon (getOrCreateE2EESession) and talks to the same mobile phone', async () => {
    // 1. Initial paired device in store
    const clientKp = sodium.crypto_kx_keypair();
    const clientKeys = nobleKxClient(
      clientKp.publicKey,
      clientKp.privateKey,
      hostKeyPair.publicKey
    );
    const deviceId = 'dev-laptop-stored-001';
    deviceStore.addDevice({
      deviceId,
      publicKey: sodium.to_base64(clientKp.publicKey),
      deviceName: 'Stored Phone',
    });

    // Daemon restarts: new RelayClient instance with empty e2eeSessions map in memory
    const config = new CompanionConfig();
    config.setEnabled(true);
    const ptyManager = new PtyManager();
    const sessionTable = new SessionTable(ptyManager);

    const restartedRelayClient = new RelayClient({
      relayUrl: 'ws://127.0.0.1:9999',
      token: 'fake-token',
      config,
      sessionTable,
      deviceStore,
      hostKeyPair,
      requireE2EE: true,
    });

    // Mobile connects and sends attach with fresh clientNonce
    const clientNonce = sodium.to_hex(sodium.randombytes_buf(16));
    let attachResp: any = null;
    vi.spyOn(restartedRelayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_ATTACH_RESP') attachResp = payload;
    });

    sessionTable.createSession('session-beta');
    await restartedRelayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-attach',
        ts: Date.now(),
        seq: 1,
        type: 'TERM_ATTACH',
        payload: {
          sessionId: 'session-beta',
          requestedMode: 'control',
          deviceId,
          clientNonce,
        },
      })
    );

    expect(attachResp).not.toBeNull();
    expect(attachResp.hostNonce).toBeDefined();
    const epoch = computeEpoch(clientNonce, attachResp.hostNonce);
    expect(attachResp.epoch).toBe(epoch);

    // Host session was created lazily by getOrCreateE2EESession with the new epoch
    const hostSession = restartedRelayClient.getE2EESession(deviceId);
    expect(hostSession).toBeDefined();
    expect(hostSession?.getEpoch()).toBe(epoch);

    // Mobile configures its session with the negotiated epoch
    const mobileSession = new MobileE2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx,
      epoch
    );

    // Send input from mobile to host
    const packet = mobileSession.encrypt('ls -la\n');
    let inputAck: any = null;
    vi.spyOn(restartedRelayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_INPUT_ACK') inputAck = payload;
    });

    await restartedRelayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: 'msg-input',
        ts: Date.now(),
        seq: 2,
        type: 'TERM_INPUT',
        payload: {
          sessionId: 'session-beta',
          inputId: 'input-1',
          generation: 1,
          data: JSON.stringify(packet),
          deviceId,
        },
      })
    );
    expect(inputAck).not.toBeNull();
  });

  it('(c) packet captured from epoch A is rejected after reconnect (epoch B) on both sides', () => {
    const clientKp = sodium.crypto_kx_keypair();
    const clientKeys = nobleKxClient(
      clientKp.publicKey,
      clientKp.privateKey,
      hostKeyPair.publicKey
    );
    const hostKeys = nobleKxServer(
      hostKeyPair.publicKey,
      hostKeyPair.privateKey,
      clientKp.publicKey
    );

    const epochA = 'epoch-alpha-000000000000000000000000000000000000000000000000000000000001';
    const epochB = 'epoch-beta-000000000000000000000000000000000000000000000000000000000002';

    // In Epoch A:
    const mobileSessionA = new MobileE2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx,
      epochA
    );
    const hostSessionA = new E2EESession(
      'host',
      hostKeys.sharedTx,
      hostKeys.sharedRx,
      epochA
    );

    const clientPacketInEpochA = mobileSessionA.encrypt('sudo systemctl restart nginx\n');
    const hostPacketInEpochA = hostSessionA.encrypt('HTTP 200 OK\n');

    expect(clientPacketInEpochA.epoch).toBe(epochA);
    expect(hostPacketInEpochA.epoch).toBe(epochA);

    // Reconnect: both sides establish Epoch B
    const mobileSessionB = new MobileE2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx,
      epochB
    );
    const hostSessionB = new E2EESession(
      'host',
      hostKeys.sharedTx,
      hostKeys.sharedRx,
      epochB
    );

    // 1. Host in Epoch B rejects client packet captured from Epoch A
    expect(() => hostSessionB.decrypt(clientPacketInEpochA)).toThrow(
      /Replay detected: packet epoch mismatch/
    );

    // Even if attacker modifies packet.epoch to epochB, Poly1305 MAC check fails
    const tamperedClientPacket = { ...clientPacketInEpochA, epoch: epochB };
    expect(() => hostSessionB.decrypt(tamperedClientPacket)).toThrow(
      /Decryption failed: tampered ciphertext or invalid key/
    );

    // 2. Mobile in Epoch B rejects host packet captured from Epoch A
    expect(() => mobileSessionB.decrypt(hostPacketInEpochA)).toThrow(
      /Replay detected: packet epoch mismatch/
    );

    // Even if attacker modifies packet.epoch to epochB, Poly1305 MAC check fails
    const tamperedHostPacket = { ...hostPacketInEpochA, epoch: epochB };
    expect(() => mobileSessionB.decrypt(tamperedHostPacket)).toThrow(
      /Decryption failed: tampered ciphertext or invalid key/
    );
  });
});
