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
  private activeChallenge: PairingChallenge | null = null;
  private pendingPairings = new Map<string, PendingPairing>();

  constructor(
    private hostKeyPair: KeyPair,
    private deviceStore?: PairedDeviceStore
  ) {}

  public createPairingChallenge(ttlMs = 5 * 60 * 1000): PairingChallenge {
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

  public verifyAndInitiate(
    code: string,
    clientPublicKeyBase64: string,
    clientDeviceName: string
  ): InitiateResult {
    if (!this.activeChallenge) {
      return { success: false, error: 'No active pairing challenge' };
    }

    if (Date.now() > this.activeChallenge.expiresAt) {
      this.activeChallenge = null;
      return { success: false, error: 'Invalid or expired pairing code' };
    }

    if (code !== this.activeChallenge.code) {
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
    return true;
  }
}
