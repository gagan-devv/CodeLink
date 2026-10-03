import { describe, it, expect, beforeAll } from 'vitest';
import { PairingManager } from './PairingManager';
import sodium from 'libsodium-wrappers';

describe('PairingManager', () => {
  beforeAll(async () => {
    await sodium.ready;
  });

  it('generates a one-time pairing code and QR payload with public key fingerprint', () => {
    const hostKeys = sodium.crypto_kx_keypair();
    const pm = new PairingManager(hostKeys);

    const challenge = pm.createPairingChallenge();
    expect(challenge.code).toMatch(/^\d{6}$/); // 6-digit numeric code
    expect(challenge.qrPayload).toBeDefined();
    expect(challenge.fingerprint).toHaveLength(64); // hex sha256/blake2b fingerprint
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects an incorrect pairing code', () => {
    const hostKeys = sodium.crypto_kx_keypair();
    const pm = new PairingManager(hostKeys);
    pm.createPairingChallenge();

    const clientKeys = sodium.crypto_kx_keypair();
    const result = pm.verifyAndInitiate(
      '000000', // wrong code
      sodium.to_base64(clientKeys.publicKey),
      'Client Phone'
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid or expired pairing code/i);
  });

  it('derives identical Short Authentication String (SAS) on host and client', () => {
    const hostKeys = sodium.crypto_kx_keypair();
    const clientKeys = sodium.crypto_kx_keypair();

    const pm = new PairingManager(hostKeys);
    const challenge = pm.createPairingChallenge();

    const hostInitiate = pm.verifyAndInitiate(
      challenge.code,
      sodium.to_base64(clientKeys.publicKey),
      'Client Phone'
    );
    expect(hostInitiate.success).toBe(true);

    // Compute SAS on host side
    const hostSas = pm.computeSas(hostInitiate.sessionToken!);

    // Compute SAS on client side from host public key + client public key + pairing code
    const clientSas = PairingManager.computeClientSas(
      hostKeys.publicKey,
      clientKeys.publicKey,
      challenge.code
    );

    expect(hostSas).toBe(clientSas);
    expect(hostSas).toHaveLength(6); // 6-character comparison string
  });

  it('requires host approval before device is registered', () => {
    const hostKeys = sodium.crypto_kx_keypair();
    const clientKeys = sodium.crypto_kx_keypair();
    const pm = new PairingManager(hostKeys);
    const challenge = pm.createPairingChallenge();

    const init = pm.verifyAndInitiate(
      challenge.code,
      sodium.to_base64(clientKeys.publicKey),
      'Client Device'
    );

    // Before approval
    expect(pm.isPendingApproval(init.sessionToken!)).toBe(true);

    // Approve
    const approved = pm.approve(init.sessionToken!);
    expect(approved).toBe(true);
    expect(pm.isPendingApproval(init.sessionToken!)).toBe(false);
  });
});
