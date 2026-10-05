import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import sodium from 'libsodium-wrappers';
import { PairingManager, KeyPair } from './PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { RelayClient } from '../transport/RelayClient';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { E2EESession } from './E2EESession';

describe('Companion Pairing Replay & Expiry Adversarial Suite', () => {
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

  it('enforces exact expiration boundary now >= expiresAt on challenge and pending', () => {
    const pm = new PairingManager(hostKeyPair, deviceStore);
    const ttlMs = 1000;
    const challenge = pm.createPairingChallenge(ttlMs);
    const clientKp = sodium.crypto_kx_keypair();

    // At exact expiresAt, challenge must expire
    const originalNow = Date.now;
    try {
      Date.now = () => challenge.expiresAt;
      const res = pm.verifyAndInitiate(
        challenge.code,
        sodium.to_base64(clientKp.publicKey),
        'Client-1',
        'attempt-1'
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('expired');
    } finally {
      Date.now = originalNow;
    }
  });

  it('invalidates pending pairings when relay session changes', () => {
    const pm = new PairingManager(hostKeyPair, deviceStore);
    const challenge = pm.createPairingChallenge();
    const clientKp = sodium.crypto_kx_keypair();

    // Initiated on session-A
    const res = pm.verifyAndInitiate(
      challenge.code,
      sodium.to_base64(clientKp.publicKey),
      'Client-A',
      'attempt-A',
      'session-A'
    );
    expect(res.success).toBe(true);
    expect(pm.listPending('session-A').length).toBe(1);

    // In session-B, listPending and approve must not expose or approve session-A's pending token
    expect(pm.listPending('session-B').length).toBe(0);
    expect(pm.approve(res.sessionToken!, 'session-B')).toBe(false);

    // Invalidate for session-A
    pm.invalidateForRelaySession('session-A');
    expect(pm.listPending('session-A').length).toBe(0);
    expect(pm.getPendingPairing(res.sessionToken!, 'session-A')).toBeNull();
  });

  it('repeated approved status polling does not reset replay sequence counter or overwrite session', async () => {
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
    });

    const clientKp = sodium.crypto_kx_keypair();
    const challenge = pm.createPairingChallenge();
    const initRes = pm.verifyAndInitiate(
      challenge.code,
      sodium.to_base64(clientKp.publicKey),
      'Mobile Client',
      'attempt-rep-1'
    );
    expect(initRes.success).toBe(true);

    // Approve on host
    expect(pm.approve(initRes.sessionToken!)).toBe(true);

    // First poll: creates host E2EESession
    let sentPayload: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_PAIR_STATUS_RESP') sentPayload = payload;
    });

    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: '1',
        ts: Date.now(),
        seq: 1,
        type: 'TERM_PAIR_STATUS',
        payload: { attemptId: 'attempt-rep-1', sessionToken: initRes.sessionToken! },
      })
    );

    expect(sentPayload.approved).toBe(true);
    const deviceId = sentPayload.deviceId;
    const establishedSession = (relayClient as any).e2eeSessions.get(deviceId);
    expect(establishedSession).toBeDefined();

    const epoch = 'test-epoch-rep-1';
    establishedSession.setEpoch(epoch);

    // Client derives client keys and sends encrypted input packet (seq = 1)
    const clientKeys = sodium.crypto_kx_client_session_keys(
      clientKp.publicKey,
      clientKp.privateKey,
      hostKeyPair.publicKey
    );
    const clientSession = new E2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx,
      epoch
    );
    const packet1 = clientSession.encrypt('echo first\n');
    expect(packet1.seq).toBe(1);

    // Feed packet1 into companion RelayClient
    sessionTable.createSession('sess-test');
    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: '2',
        ts: Date.now(),
        seq: 2,
        type: 'TERM_INPUT',
        payload: {
          sessionId: 'sess-test',
          inputId: 'input-1',
          generation: 1,
          data: JSON.stringify(packet1),
          deviceId,
        },
      })
    );

    // Now, poll status AGAIN (re-polling)
    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: '3',
        ts: Date.now(),
        seq: 3,
        type: 'TERM_PAIR_STATUS',
        payload: { attemptId: 'attempt-rep-1', sessionToken: initRes.sessionToken! },
      })
    );

    // The session object must be the EXACT SAME object, not recreated!
    const sessionAfterSecondPoll = (relayClient as any).e2eeSessions.get(deviceId);
    expect(sessionAfterSecondPoll).toBe(establishedSession);

    // Attempt to replay packet1 with a different inputId ("input-2") to bypass deduplicator
    let errorMessage: any = null;
    vi.spyOn(relayClient, 'sendTerminalEnvelope').mockImplementation((type: any, payload: any) => {
      if (type === 'TERM_ERROR') errorMessage = payload;
    });

    await relayClient.handleMessage(
      JSON.stringify({
        v: 1,
        id: '4',
        ts: Date.now(),
        seq: 4,
        type: 'TERM_INPUT',
        payload: {
          sessionId: 'sess-test',
          inputId: 'input-2', // Different outer inputId!
          generation: 1,
          data: JSON.stringify(packet1),
          deviceId,
        },
      })
    );

    // Must be rejected by E2EE decryption as a replay attack!
    expect(errorMessage).not.toBeNull();
    expect(errorMessage.code).toBe('DECRYPTION_FAILED');
    expect(errorMessage.message).toContain('Replay detected');
  });

  it('rejects cross-connection epoch replay attack even if sequence number matches', () => {
    const clientKp = sodium.crypto_kx_keypair();
    const clientKeys = sodium.crypto_kx_client_session_keys(
      clientKp.publicKey,
      clientKp.privateKey,
      hostKeyPair.publicKey
    );
    const hostKeys = sodium.crypto_kx_server_session_keys(
      hostKeyPair.publicKey,
      hostKeyPair.privateKey,
      clientKp.publicKey
    );

    // Connection Epoch 1
    const clientSessionEpoch1 = new E2EESession(
      'client',
      clientKeys.sharedTx,
      clientKeys.sharedRx,
      'epoch-001'
    );
    const packetEpoch1 = clientSessionEpoch1.encrypt('secret command\n');
    expect(packetEpoch1.seq).toBe(1);
    expect(packetEpoch1.epoch).toBe('epoch-001');

    // Connection Epoch 2 (after re-connect)
    const hostSessionEpoch2 = new E2EESession(
      'host',
      hostKeys.sharedTx,
      hostKeys.sharedRx,
      'epoch-002'
    );

    // Attacker attempts to replay packet from epoch 1 in epoch 2
    expect(() => hostSessionEpoch2.decrypt(packetEpoch1)).toThrow(/Replay detected: packet epoch mismatch/);

    // Even if attacker modifies packet.epoch to 'epoch-002', Poly1305 MAC authentication fails
    const tamperedPacket = { ...packetEpoch1, epoch: 'epoch-002' };
    expect(() => hostSessionEpoch2.decrypt(tamperedPacket)).toThrow(/Decryption failed/);
  });
});
