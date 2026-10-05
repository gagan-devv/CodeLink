import { describe, it, expect, beforeAll } from 'vitest';
import { E2EESession } from './E2EESession';
import sodium from 'libsodium-wrappers';

describe('E2EESession (E2EE, Replay Protection, Relay Opacity)', () => {
  beforeAll(async () => {
    await sodium.ready;
  });

  function createPairedSessions() {
    const hostKeys = sodium.crypto_kx_keypair();
    const clientKeys = sodium.crypto_kx_keypair();

    // Key exchange using libsodium crypto_kx
    const hostRxTx = sodium.crypto_kx_server_session_keys(
      hostKeys.publicKey,
      hostKeys.privateKey,
      clientKeys.publicKey
    );

    const clientRxTx = sodium.crypto_kx_client_session_keys(
      clientKeys.publicKey,
      clientKeys.privateKey,
      hostKeys.publicKey
    );

    // Host session sends with hostRxTx.sharedTx and receives with hostRxTx.sharedRx
    const hostSession = new E2EESession('host', hostRxTx.sharedTx, hostRxTx.sharedRx, 'test-epoch');
    // Client session sends with clientRxTx.sharedTx (which equals hostRxTx.sharedRx)
    // and receives with clientRxTx.sharedRx (which equals hostRxTx.sharedTx)
    const clientSession = new E2EESession('client', clientRxTx.sharedTx, clientRxTx.sharedRx, 'test-epoch');

    return { hostSession, clientSession, hostKeys, clientKeys };
  }

  it('encrypts on one side and decrypts on the other with plaintext fidelity', () => {
    const { hostSession, clientSession } = createPairedSessions();

    const plaintext = 'echo "hello secret terminal"\n';
    const encryptedPacket = clientSession.encrypt(plaintext);

    expect(encryptedPacket.ciphertext).not.toBe(plaintext);
    expect(encryptedPacket.seq).toBe(1);

    const decrypted = hostSession.decrypt(encryptedPacket);
    expect(decrypted).toBe(plaintext);
  });

  it('rejects tampered ciphertext with authentication tag failure', () => {
    const { hostSession, clientSession } = createPairedSessions();

    const packet = clientSession.encrypt('sensitive data');

    // Tamper with the ciphertext by flipping a bit
    const rawCipher = Buffer.from(packet.ciphertext, 'base64');
    rawCipher[0] ^= 0x01; // flip first bit
    const tamperedPacket = {
      ...packet,
      ciphertext: rawCipher.toString('base64'),
    };

    expect(() => {
      hostSession.decrypt(tamperedPacket);
    }).toThrow(/authentication|decryption failed/i);
  });

  it('rejects replayed messages (sequence number <= last seen)', () => {
    const { hostSession, clientSession } = createPairedSessions();

    const packet1 = clientSession.encrypt('first command');
    const packet2 = clientSession.encrypt('second command');

    expect(hostSession.decrypt(packet1)).toBe('first command');
    expect(hostSession.decrypt(packet2)).toBe('second command');

    // Attempt to replay packet1
    expect(() => {
      hostSession.decrypt(packet1);
    }).toThrow(/replay detected|invalid sequence/i);
  });

  it('rejects reordered messages (out of order sequence numbers)', () => {
    const { hostSession, clientSession } = createPairedSessions();

    const packet1 = clientSession.encrypt('msg 1');
    const packet2 = clientSession.encrypt('msg 2');

    // Deliver packet 2 before packet 1
    expect(hostSession.decrypt(packet2)).toBe('msg 2');

    // Now delivering packet 1 (stale sequence) must be rejected
    expect(() => {
      hostSession.decrypt(packet1);
    }).toThrow(/replay detected|invalid sequence/i);
  });

  it('rotates session keys and continues encryption/decryption transparently', () => {
    const { hostSession, clientSession } = createPairedSessions();

    const beforeMsg = clientSession.encrypt('before rotation');
    expect(hostSession.decrypt(beforeMsg)).toBe('before rotation');

    // Rotate keys on both sides
    const newHostKeys = sodium.crypto_kx_keypair();
    const newClientKeys = sodium.crypto_kx_keypair();

    const newHostRxTx = sodium.crypto_kx_server_session_keys(
      newHostKeys.publicKey,
      newHostKeys.privateKey,
      newClientKeys.publicKey
    );
    const newClientRxTx = sodium.crypto_kx_client_session_keys(
      newClientKeys.publicKey,
      newClientKeys.privateKey,
      newHostKeys.publicKey
    );

    hostSession.rotateKeys(newHostRxTx.sharedTx, newHostRxTx.sharedRx);
    clientSession.rotateKeys(newClientRxTx.sharedTx, newClientRxTx.sharedRx);

    const afterMsg = clientSession.encrypt('after rotation');
    expect(hostSession.decrypt(afterMsg)).toBe('after rotation');
  });

  it('verifies a recording relay cannot decrypt terminal ciphertext', () => {
    const { hostSession, clientSession } = createPairedSessions();

    // A mock recording relay intercepts all in-flight packets
    const relayRecordedTraffic: Array<{ seq: number; ciphertext: string }> = [];

    const sendThroughRelay = (pkt: { seq: number; ciphertext: string; nonce: string }) => {
      // Relay stores the intercepted packet
      relayRecordedTraffic.push({ seq: pkt.seq, ciphertext: pkt.ciphertext });
      // Forward to host
      return hostSession.decrypt(pkt);
    };

    const secretPayload = 'rm -rf /tmp/my-secret-key; export AWS_SECRET=xyz123';
    const clientPacket = clientSession.encrypt(secretPayload);

    const receivedByHost = sendThroughRelay(clientPacket);
    expect(receivedByHost).toBe(secretPayload);

    // Assert that the relay recorded the packet
    expect(relayRecordedTraffic).toHaveLength(1);
    const intercepted = relayRecordedTraffic[0];

    // The relay tries to parse or find the plaintext in the intercepted ciphertext
    expect(intercepted.ciphertext).not.toContain('AWS_SECRET');
    expect(intercepted.ciphertext).not.toContain('xyz123');

    // Attempting to decrypt on relay without keys must fail
    const dummyKey = sodium.randombytes_buf(32);
    expect(() => {
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        sodium.from_base64(intercepted.ciphertext),
        null,
        sodium.from_base64(clientPacket.nonce),
        dummyKey
      );
    }).toThrow();
  });
});
