import sodium from 'libsodium-wrappers';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';

export interface KeyPair {
  keyType: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PairingChallenge {
  code: string;
  fingerprint: string;
  qrPayload: string;
  expiresAt: number;
}

export interface InitiateResult {
  success: boolean;
  sessionToken?: string;
  error?: string;
}

interface PendingPairing {
  sessionToken: string;
  code: string;
  clientPublicKey: Uint8Array;
  clientDeviceName: string;
  createdAt: number;
  approved: boolean;
}

export class PairingManager {
  public static readonly MAX_ATTEMPTS = 5;
  public static readonly DEFAULT_TTL_MS = 5 * 60 * 1000;

  private activeChallenge: PairingChallenge | null = null;
  private attemptCount = 0;
  private pendingPairings = new Map<string, PendingPairing>();

  constructor(
    private hostKeyPair: KeyPair,
    private deviceStore?: PairedDeviceStore
  ) {}

  public getRemainingAttempts(): number {
    if (!this.activeChallenge) {
      return 0;
    }
    return Math.max(0, PairingManager.MAX_ATTEMPTS - this.attemptCount);
  }

  public getActiveChallenge(): PairingChallenge | null {
    return this.activeChallenge;
  }

  public createPairingChallenge(ttlMs = PairingManager.DEFAULT_TTL_MS): PairingChallenge {
    this.attemptCount = 0;

    // Generate 6-digit numeric pairing code (100000 - 999999)
    const codeNum = 100000 + sodium.randombytes_uniform(900000);
    const code = codeNum.toString();

    // Compute 64-character hex fingerprint of host public key using crypto_generichash
    const hash = sodium.crypto_generichash(32, this.hostKeyPair.publicKey, null);
    const fingerprint = sodium.to_hex(hash);

    const expiresAt = Date.now() + ttlMs;

    const qrData = {
      type: 'codelink-terminal-pairing',
      hostPublicKey: sodium.to_base64(this.hostKeyPair.publicKey),
      fingerprint,
      code,
      expiresAt,
    };
    const qrPayload = Buffer.from(JSON.stringify(qrData)).toString('base64');

    this.activeChallenge = {
      code,
      fingerprint,
      qrPayload,
      expiresAt,
    };

    return this.activeChallenge;
  }

  /**
   * Constant-time comparison of two strings to prevent timing attacks.
   * Hashes both inputs to 32 bytes using crypto_generichash so comparison length
   * is always identical, then compares in constant time using sodium.memcmp.
   */
  public static constantTimeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    const hashA = sodium.crypto_generichash(32, bufA, null);
    const hashB = sodium.crypto_generichash(32, bufB, null);
    return sodium.memcmp(hashA, hashB);
  }

  public verifyAndInitiate(
    code: string,
    clientPublicKeyBase64: string,
    clientDeviceName: string
  ): InitiateResult {
    if (!this.activeChallenge) {
      return { success: false, error: 'No active pairing challenge' };
    }

    if (Date.now() >= this.activeChallenge.expiresAt) {
      this.activeChallenge = null;
      this.attemptCount = 0;
      return { success: false, error: 'Invalid or expired pairing code' };
    }

    if (!PairingManager.constantTimeCompare(code, this.activeChallenge.code)) {
      this.attemptCount++;
      if (this.attemptCount >= PairingManager.MAX_ATTEMPTS) {
        this.activeChallenge = null;
        this.attemptCount = 0;
        return {
          success: false,
          error: 'Invalid or expired pairing code: maximum attempts exceeded',
        };
      }
      return { success: false, error: 'Invalid or expired pairing code' };
    }

    let clientPubKeyBytes: Uint8Array;
    try {
      clientPubKeyBytes = sodium.from_base64(clientPublicKeyBase64);
    } catch {
      return { success: false, error: 'Invalid client public key' };
    }

    const sessionToken = sodium.to_hex(sodium.randombytes_buf(16));
    this.pendingPairings.set(sessionToken, {
      sessionToken,
      code,
      clientPublicKey: clientPubKeyBytes,
      clientDeviceName,
      createdAt: Date.now(),
      approved: false,
    });

    // Invalidate single-use challenge once initiated
    this.activeChallenge = null;
    this.attemptCount = 0;

    return {
      success: true,
      sessionToken,
    };
  }

  public computeSas(sessionToken: string): string {
    const pending = this.pendingPairings.get(sessionToken);
    if (!pending) {
      throw new Error('Pending pairing not found');
    }

    return PairingManager.computeClientSas(
      this.hostKeyPair.publicKey,
      pending.clientPublicKey,
      pending.code
    );
  }

  public static computeClientSas(
    hostPublicKey: Uint8Array,
    clientPublicKey: Uint8Array,
    code: string
  ): string {
    // Deterministic hash of hostPubKey + clientPubKey + pairingCode
    const combined = new Uint8Array(
      hostPublicKey.length + clientPublicKey.length + Buffer.byteLength(code)
    );
    combined.set(hostPublicKey, 0);
    combined.set(clientPublicKey, hostPublicKey.length);
    combined.set(Buffer.from(code, 'utf8'), hostPublicKey.length + clientPublicKey.length);

    const hash = sodium.crypto_generichash(16, combined, null);
    // Format into 6 uppercase alphanumeric chars
    const hex = sodium.to_hex(hash);
    return hex.slice(0, 6).toUpperCase();
  }

  public isPendingApproval(sessionToken: string): boolean {
    const pending = this.pendingPairings.get(sessionToken);
    if (!pending) {
      return false;
    }
    return !pending.approved;
  }

  public approve(sessionToken: string): boolean {
    const pending = this.pendingPairings.get(sessionToken);
    if (!pending) {
      return false;
    }

    pending.approved = true;

    if (this.deviceStore) {
      const deviceId = `dev-${sodium.to_hex(sodium.crypto_generichash(8, pending.clientPublicKey, null))}`;
      this.deviceStore.addDevice({
        deviceId,
        deviceName: pending.clientDeviceName,
        publicKey: sodium.to_base64(pending.clientPublicKey),
      });
    }

    // Invalidate single-use pairing challenge
    this.activeChallenge = null;
    this.attemptCount = 0;
    return true;
  }

  public getHostKeyPair(): KeyPair {
    return this.hostKeyPair;
  }

  public getDeviceStore(): PairedDeviceStore | undefined {
    return this.deviceStore;
  }

  public getPairingStatus(sessionToken: string): {
    approved: boolean;
    deviceId?: string;
    hostPublicKey?: string;
    clientPublicKey?: Uint8Array;
    error?: string;
  } {
    const pending = this.pendingPairings.get(sessionToken);
    if (!pending) {
      return { approved: false, error: 'Pairing session not found or expired' };
    }
    if (!pending.approved) {
      return { approved: false };
    }
    const deviceId = `dev-${sodium.to_hex(sodium.crypto_generichash(8, pending.clientPublicKey, null))}`;
    return {
      approved: true,
      deviceId,
      hostPublicKey: sodium.to_base64(this.hostKeyPair.publicKey),
      clientPublicKey: pending.clientPublicKey,
    };
  }
}
