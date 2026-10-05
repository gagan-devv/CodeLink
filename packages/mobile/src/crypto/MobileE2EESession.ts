import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { EncryptedPacket } from '@codelink/protocol';
import { secureRandomBytes } from './random';
import { toBase64, fromBase64, encodeUtf8, decodeUtf8 } from './nobleKx';

export class MobileE2EESession {
  private outboundSeq = 0;
  private lastInboundSeq = 0;
  private epoch?: string;

  constructor(
    public readonly role: 'client' | 'host',
    private txKey: Uint8Array,
    private rxKey: Uint8Array,
    epoch?: string
  ) {
    this.epoch = epoch;
  }

  public getEpoch(): string | undefined {
    return this.epoch;
  }

  public setEpoch(epoch: string): void {
    this.epoch = epoch;
    this.outboundSeq = 0;
    this.lastInboundSeq = 0;
  }

  public rotateKeys(newTxKey: Uint8Array, newRxKey: Uint8Array): void {
    this.txKey = newTxKey;
    this.rxKey = newRxKey;
  }

  public encrypt(plaintext: string): EncryptedPacket {
    this.outboundSeq++;
    const seq = this.outboundSeq;

    // Fresh 24-byte random nonce using CSPRNG per packet
    const nonce = secureRandomBytes(24);
    const additionalDataStr = this.epoch ? `epoch:${this.epoch}:seq:${seq}` : `seq:${seq}`;
    const additionalData = encodeUtf8(additionalDataStr);
    const messageBytes = encodeUtf8(plaintext);

    const cipher = xchacha20poly1305(this.txKey, nonce, additionalData);
    const ciphertext = cipher.encrypt(messageBytes);

    return {
      seq,
      epoch: this.epoch,
      nonce: toBase64(nonce),
      ciphertext: toBase64(ciphertext),
    };
  }

  public decrypt(packet: EncryptedPacket): string {
    if (this.epoch && packet.epoch !== this.epoch) {
      throw new Error(`Replay detected: packet epoch mismatch (${packet.epoch} !== ${this.epoch})`);
    }

    // Replay attack and re-ordering protection
    if (packet.seq <= this.lastInboundSeq) {
      throw new Error(
        `Replay detected: invalid sequence number ${packet.seq} <= last seen ${this.lastInboundSeq}`
      );
    }

    let decryptedBytes: Uint8Array;
    try {
      const nonceBytes = fromBase64(packet.nonce);
      const ciphertextBytes = fromBase64(packet.ciphertext);
      const additionalDataStr = packet.epoch
        ? `epoch:${packet.epoch}:seq:${packet.seq}`
        : `seq:${packet.seq}`;
      const additionalData = encodeUtf8(additionalDataStr);

      const cipher = xchacha20poly1305(this.rxKey, nonceBytes, additionalData);
      decryptedBytes = cipher.decrypt(ciphertextBytes);
    } catch {
      throw new Error('Decryption failed: tampered ciphertext or invalid key');
    }

    this.lastInboundSeq = packet.seq;
    return decodeUtf8(decryptedBytes);
  }
}
