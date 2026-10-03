import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { EncryptedPacket } from '@codelink/protocol';
import { secureRandomBytes } from './random';
import { toBase64, fromBase64, encodeUtf8, decodeUtf8 } from './nobleKx';

export class MobileE2EESession {
  private outboundSeq = 0;
  private lastInboundSeq = 0;

  constructor(
    public readonly role: 'client' | 'host',
    private txKey: Uint8Array,
    private rxKey: Uint8Array
  ) {}

  public rotateKeys(newTxKey: Uint8Array, newRxKey: Uint8Array): void {
    this.txKey = newTxKey;
    this.rxKey = newRxKey;
  }

  public encrypt(plaintext: string): EncryptedPacket {
    this.outboundSeq++;
    const seq = this.outboundSeq;

    // Fresh 24-byte random nonce using CSPRNG per packet
    const nonce = secureRandomBytes(24);
    const additionalData = encodeUtf8(`seq:${seq}`);
    const messageBytes = encodeUtf8(plaintext);

    const cipher = xchacha20poly1305(this.txKey, nonce, additionalData);
    const ciphertext = cipher.encrypt(messageBytes);

    return {
      seq,
      nonce: toBase64(nonce),
      ciphertext: toBase64(ciphertext),
    };
  }

  public decrypt(packet: EncryptedPacket): string {
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
      const additionalData = encodeUtf8(`seq:${packet.seq}`);

      const cipher = xchacha20poly1305(this.rxKey, nonceBytes, additionalData);
      decryptedBytes = cipher.decrypt(ciphertextBytes);
    } catch {
      throw new Error('Decryption failed: tampered ciphertext or invalid key');
    }

    this.lastInboundSeq = packet.seq;
    return decodeUtf8(decryptedBytes);
  }
}
