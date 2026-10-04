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

  describe('Pairing Hardening Rules', () => {
    it('limits pairing code attempts to 5 and invalidates the challenge after 5 failures', () => {
      const hostKeys = sodium.crypto_kx_keypair();
      const clientKeys = sodium.crypto_kx_keypair();
      const pm = new PairingManager(hostKeys);
      const challenge = pm.createPairingChallenge();
      const clientPubKeyBase64 = sodium.to_base64(clientKeys.publicKey);

      expect(pm.getRemainingAttempts()).toBe(5);

      // Attempts 1 through 4: should fail, challenge remains active, attempts decrement
      for (let i = 1; i <= 4; i++) {
        const res = pm.verifyAndInitiate('000000', clientPubKeyBase64, 'Attacker Phone');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/invalid or expired pairing code/i);
        expect(pm.getRemainingAttempts()).toBe(5 - i);
        expect(pm.getActiveChallenge()).not.toBeNull();
      }

      // 5th attempt: fails and invalidates the challenge
      const res5 = pm.verifyAndInitiate('000000', clientPubKeyBase64, 'Attacker Phone');
      expect(res5.success).toBe(false);
      expect(res5.error).toMatch(/invalid or expired pairing code/i);
      expect(pm.getRemainingAttempts()).toBe(0);
      expect(pm.getActiveChallenge()).toBeNull();

      // 6th attempt with the CORRECT code: fails because challenge was invalidated
      const res6 = pm.verifyAndInitiate(challenge.code, clientPubKeyBase64, 'Valid Phone');
      expect(res6.success).toBe(false);
      expect(res6.error).toMatch(/no active pairing challenge/i);
    });

    it('allows successful pairing on the 5th attempt if the code is correct', () => {
      const hostKeys = sodium.crypto_kx_keypair();
      const clientKeys = sodium.crypto_kx_keypair();
      const pm = new PairingManager(hostKeys);
      const challenge = pm.createPairingChallenge();
      const clientPubKeyBase64 = sodium.to_base64(clientKeys.publicKey);

      // 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        const res = pm.verifyAndInitiate('000000', clientPubKeyBase64, 'Phone');
        expect(res.success).toBe(false);
        expect(pm.getRemainingAttempts()).toBe(5 - i);
      }

      // 5th attempt with correct code succeeds
      const res5 = pm.verifyAndInitiate(challenge.code, clientPubKeyBase64, 'Phone');
      expect(res5.success).toBe(true);
      expect(res5.sessionToken).toBeDefined();
    });

    it('enforces single use: challenge cannot be reused once verified and initiated', () => {
      const hostKeys = sodium.crypto_kx_keypair();
      const clientKeys1 = sodium.crypto_kx_keypair();
      const clientKeys2 = sodium.crypto_kx_keypair();
      const pm = new PairingManager(hostKeys);
      const challenge = pm.createPairingChallenge();

      // First initiation succeeds
      const res1 = pm.verifyAndInitiate(
        challenge.code,
        sodium.to_base64(clientKeys1.publicKey),
        'Phone 1'
      );
      expect(res1.success).toBe(true);
      expect(pm.getActiveChallenge()).toBeNull();

      // Second initiation with identical code fails (single use)
      const res2 = pm.verifyAndInitiate(
        challenge.code,
        sodium.to_base64(clientKeys2.publicKey),
        'Phone 2'
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toMatch(/no active pairing challenge/i);
    });

    it('enforces 5 minute expiry for pairing challenges', () => {
      const hostKeys = sodium.crypto_kx_keypair();
      const clientKeys = sodium.crypto_kx_keypair();
      const pm = new PairingManager(hostKeys);
      const now = Date.now();
      const challenge = pm.createPairingChallenge();

      // Default TTL is exactly 5 minutes (300,000 ms)
      expect(challenge.expiresAt).toBeGreaterThanOrEqual(now + 5 * 60 * 1000 - 100);
      expect(challenge.expiresAt).toBeLessThanOrEqual(now + 5 * 60 * 1000 + 1000);

      // Expired challenge is rejected and invalidated
      const expiredChallenge = pm.createPairingChallenge(-1000); // expired 1s in the past
      expect(pm.getActiveChallenge()).not.toBeNull();

      const res = pm.verifyAndInitiate(
        expiredChallenge.code,
        sodium.to_base64(clientKeys.publicKey),
        'Phone'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid or expired pairing code/i);
      expect(pm.getActiveChallenge()).toBeNull();
    });

    it('performs constant-time string comparison', () => {
      expect(PairingManager.constantTimeCompare('123456', '123456')).toBe(true);
      expect(PairingManager.constantTimeCompare('123456', '123457')).toBe(false);
      expect(PairingManager.constantTimeCompare('123456', '654321')).toBe(false);
      expect(PairingManager.constantTimeCompare('123', '123456')).toBe(false);
      expect(PairingManager.constantTimeCompare('12345678', '123456')).toBe(false);
      expect(PairingManager.constantTimeCompare('', '')).toBe(true);
      expect(PairingManager.constantTimeCompare('', '123456')).toBe(false);
      expect(PairingManager.constantTimeCompare(null as unknown as string, '123456')).toBe(false);
      expect(PairingManager.constantTimeCompare('123456', undefined as unknown as string)).toBe(
        false
      );
    });

    it('lists pending pairings and supports rejection', () => {
      const hostKeys = sodium.crypto_kx_keypair();
      const clientKeys = sodium.crypto_kx_keypair();
      const pm = new PairingManager(hostKeys);
      const challenge = pm.createPairingChallenge();

      const initRes = pm.verifyAndInitiate(
        challenge.code,
        sodium.to_base64(clientKeys.publicKey),
        'My Pixel Phone'
      );
      expect(initRes.success).toBe(true);

      const pendingList = pm.listPending();
      expect(pendingList.length).toBe(1);
      expect(pendingList[0].sessionToken).toBe(initRes.sessionToken);
      expect(pendingList[0].clientDeviceName).toBe('My Pixel Phone');
      expect(pendingList[0].sas).toHaveLength(6);
      expect(pendingList[0].fingerprint).toHaveLength(64);

      // Rejection
      const rejRes = pm.reject(initRes.sessionToken!);
      expect(rejRes).toBe(true);
      expect(pm.listPending().length).toBe(0);
      expect(pm.approve(initRes.sessionToken!)).toBe(false);
    });

    it('enforces TTL on pending pairing sessions', () => {
      const hostKeys = sodium.crypto_kx_keypair();
      const clientKeys = sodium.crypto_kx_keypair();
      const pm = new PairingManager(hostKeys);
      const challenge = pm.createPairingChallenge();

      const initRes = pm.verifyAndInitiate(
        challenge.code,
        sodium.to_base64(clientKeys.publicKey),
        'Pixel'
      );
      expect(initRes.success).toBe(true);

      // Manually simulate expiration by modifying creation time internally
      const pendingMap = (pm as any).pendingPairings;
      const record = pendingMap.get(initRes.sessionToken!);
      record.createdAt = Date.now() - (6 * 60 * 1000); // 6 mins ago (> 5 mins)

      expect(pm.listPending().length).toBe(0);
      expect(pm.approve(initRes.sessionToken!)).toBe(false);
      const status = pm.getPairingStatus(initRes.sessionToken!);
      expect(status.approved).toBe(false);
      expect(status.error).toContain('expired');
    });
  });
});
