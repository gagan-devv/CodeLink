import { describe, it, expect, beforeAll } from 'vitest';
import sodium from 'libsodium-wrappers';
import { x25519 } from '@noble/curves/ed25519';
import {
  nobleKxClient,
  nobleKxServer,
  computeClientSas,
  computeDeviceId,
  toBase64,
  fromBase64,
  toHex,
  fromHex,
} from './nobleKx';
import { MobileE2EESession } from './MobileE2EESession';
import { E2EESession } from '../../../companion/src/crypto/E2EESession';
import { PairingManager } from '../../../companion/src/crypto/PairingManager';
import { secureRandomBytes } from './random';

describe('MobileCrypto Cross-Compatibility and E2EE', () => {
  beforeAll(async () => {
    await sodium.ready;
  });

  it('verifies noble crypto_kx matches libsodium crypto_kx bit-for-bit on fixed keypairs', () => {
    // Generate server (companion) and client (mobile) keypairs using libsodium
    const serverKx = sodium.crypto_kx_keypair();
    const clientKx = sodium.crypto_kx_keypair();

    // 1. Libsodium key derivation
    const sodiumServerKeys = sodium.crypto_kx_server_session_keys(
      serverKx.publicKey,
      serverKx.privateKey,
      clientKx.publicKey
    );
    const sodiumClientKeys = sodium.crypto_kx_client_session_keys(
      clientKx.publicKey,
      clientKx.privateKey,
      serverKx.publicKey
    );

    // 2. Noble key derivation (hand-written crypto_kx)
    const nobleClientKeys = nobleKxClient(
      clientKx.publicKey,
      clientKx.privateKey,
      serverKx.publicKey
    );
    const nobleServerKeys = nobleKxServer(
      serverKx.publicKey,
      serverKx.privateKey,
      clientKx.publicKey
    );

    // Assert exact bit-for-bit equality between noble and libsodium
    expect(toHex(nobleClientKeys.sharedTx)).toBe(toHex(sodiumClientKeys.sharedTx));
    expect(toHex(nobleClientKeys.sharedRx)).toBe(toHex(sodiumClientKeys.sharedRx));
    expect(toHex(nobleServerKeys.sharedTx)).toBe(toHex(sodiumServerKeys.sharedTx));
    expect(toHex(nobleServerKeys.sharedRx)).toBe(toHex(sodiumServerKeys.sharedRx));

    // Assert reciprocal key agreement: client Tx == server Rx, and client Rx == server Tx
    expect(toHex(nobleClientKeys.sharedTx)).toBe(toHex(nobleServerKeys.sharedRx));
    expect(toHex(nobleClientKeys.sharedRx)).toBe(toHex(nobleServerKeys.sharedTx));
  });

  it('cross-decrypts mobile noble packets on companion libsodium session', () => {
    const serverKx = sodium.crypto_kx_keypair();
    const clientKx = sodium.crypto_kx_keypair();

    const serverKeys = sodium.crypto_kx_server_session_keys(
      serverKx.publicKey,
      serverKx.privateKey,
      clientKx.publicKey
    );
    const clientKeys = nobleKxClient(
      clientKx.publicKey,
      clientKx.privateKey,
      serverKx.publicKey
    );

    const mobileSession = new MobileE2EESession('client', clientKeys.sharedTx, clientKeys.sharedRx, 'test-epoch');
    const companionSession = new E2EESession('host', serverKeys.sharedTx, serverKeys.sharedRx, 'test-epoch');

    const testPayload = 'ls -la /home/user\n';
    const encryptedByMobile = mobileSession.encrypt(testPayload);

    // Verify packet structure
    expect(encryptedByMobile.seq).toBe(1);
    expect(encryptedByMobile.ciphertext).not.toBe(testPayload);

    // Companion decrypts using libsodium XChaCha20-Poly1305
    const decryptedByCompanion = companionSession.decrypt(encryptedByMobile);
    expect(decryptedByCompanion).toBe(testPayload);
  });

  it('cross-decrypts companion libsodium packets on mobile noble session', () => {
    const serverKx = sodium.crypto_kx_keypair();
    const clientKx = sodium.crypto_kx_keypair();

    const serverKeys = sodium.crypto_kx_server_session_keys(
      serverKx.publicKey,
      serverKx.privateKey,
      clientKx.publicKey
    );
    const clientKeys = nobleKxClient(
      clientKx.publicKey,
      clientKx.privateKey,
      serverKx.publicKey
    );

    const mobileSession = new MobileE2EESession('client', clientKeys.sharedTx, clientKeys.sharedRx, 'test-epoch');
    const companionSession = new E2EESession('host', serverKeys.sharedTx, serverKeys.sharedRx, 'test-epoch');

    const ptyOutput = '\x1b[32muser@laptop\x1b[0m:~$ total 42\r\n';
    const encryptedByCompanion = companionSession.encrypt(ptyOutput);

    // Mobile decrypts using @noble/ciphers XChaCha20-Poly1305
    const decryptedByMobile = mobileSession.decrypt(encryptedByCompanion);
    expect(decryptedByMobile).toBe(ptyOutput);
  });

  it('rejects wrong session key on both sides', () => {
    const serverKx = sodium.crypto_kx_keypair();
    const clientKx = sodium.crypto_kx_keypair();
    const rogueKx = sodium.crypto_kx_keypair();

    const legitimateKeys = nobleKxClient(clientKx.publicKey, clientKx.privateKey, serverKx.publicKey);
    const rogueKeys = nobleKxClient(rogueKx.publicKey, rogueKx.privateKey, serverKx.publicKey);
    const companionKeys = sodium.crypto_kx_server_session_keys(
      serverKx.publicKey,
      serverKx.privateKey,
      clientKx.publicKey
    );

    const rogueSession = new MobileE2EESession('client', rogueKeys.sharedTx, rogueKeys.sharedRx, 'test-epoch');
    const legitimateSession = new MobileE2EESession('client', legitimateKeys.sharedTx, legitimateKeys.sharedRx, 'test-epoch');
    const companionSession = new E2EESession('host', companionKeys.sharedTx, companionKeys.sharedRx, 'test-epoch');

    // Rogue packet sent to companion
    const roguePacket = rogueSession.encrypt('malicious payload');
    expect(() => companionSession.decrypt(roguePacket)).toThrow(/decryption failed/i);

    // Tampered packet sent to mobile
    const legitPacket = companionSession.encrypt('secret');
    const tampered = { ...legitPacket, ciphertext: toBase64(fromBase64(legitPacket.ciphertext).map((b, i) => i === 0 ? b ^ 0xff : b)) };
    expect(() => legitimateSession.decrypt(tampered)).toThrow(/decryption failed/i);
  });

  it('rejects replayed nonce and packet sequence number', () => {
    const serverKx = sodium.crypto_kx_keypair();
    const clientKx = sodium.crypto_kx_keypair();

    const serverKeys = sodium.crypto_kx_server_session_keys(
      serverKx.publicKey,
      serverKx.privateKey,
      clientKx.publicKey
    );
    const clientKeys = nobleKxClient(
      clientKx.publicKey,
      clientKx.privateKey,
      serverKx.publicKey
    );

    const mobileSession = new MobileE2EESession('client', clientKeys.sharedTx, clientKeys.sharedRx, 'test-epoch');
    const companionSession = new E2EESession('host', serverKeys.sharedTx, serverKeys.sharedRx, 'test-epoch');

    const pkt1 = mobileSession.encrypt('cmd 1');
    const pkt2 = mobileSession.encrypt('cmd 2');

    expect(companionSession.decrypt(pkt1)).toBe('cmd 1');
    expect(companionSession.decrypt(pkt2)).toBe('cmd 2');

    // Replay pkt1
    expect(() => companionSession.decrypt(pkt1)).toThrow(/replay detected/i);

    // Reverse direction replay check
    const out1 = companionSession.encrypt('resp 1');
    const out2 = companionSession.encrypt('resp 2');

    expect(mobileSession.decrypt(out1)).toBe('resp 1');
    expect(mobileSession.decrypt(out2)).toBe('resp 2');

    // Replay out1 on mobile
    expect(() => mobileSession.decrypt(out1)).toThrow(/replay detected/i);
  });

  it('matches SAS computation identically between noble and companion PairingManager', () => {
    const hostKx = sodium.crypto_kx_keypair();
    const clientKx = sodium.crypto_kx_keypair();
    const pairingCode = '849201';
    const attemptId = 'att-xyz';
    const sessionToken = 'tok-123';

    const companionSas = PairingManager.computeClientSas(
      hostKx.publicKey,
      clientKx.publicKey,
      pairingCode,
      attemptId,
      sessionToken
    );
    const nobleSas = computeClientSas(
      hostKx.publicKey,
      clientKx.publicKey,
      pairingCode,
      attemptId,
      sessionToken
    );

    expect(nobleSas).toHaveLength(14);
    expect(nobleSas).toBe(companionSas);
  });

  it('matches deviceId computation identically', () => {
    const clientKx = sodium.crypto_kx_keypair();
    const expectedDeviceId = `dev-${sodium.to_hex(sodium.crypto_generichash(8, clientKx.publicKey, null))}`;

    const computedId = computeDeviceId(clientKx.publicKey);
    expect(computedId).toBe(expectedDeviceId);
    expect(computedId.startsWith('dev-')).toBe(true);
    expect(computedId).toHaveLength(20); // 'dev-' (4) + 16 hex chars
  });

  it('enforces secure randomness and CSPRNG', () => {
    const bytes1 = secureRandomBytes(32);
    const bytes2 = secureRandomBytes(32);

    expect(bytes1).toHaveLength(32);
    expect(bytes2).toHaveLength(32);
    expect(toHex(bytes1)).not.toBe(toHex(bytes2));
  });
});
