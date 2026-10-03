import sodium from 'libsodium-wrappers';

export interface EncryptedPacket {
  seq: number;
  nonce: string;
  ciphertext: string;
}

export class E2EESession {
  private outboundSeq = 0;
  private lastInboundSeq = 0;

  constructor(
    public readonly role: 'host' | 'client',
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

    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    const messageBytes = sodium.from_string(plaintext);
    const additionalData = sodium.from_string(`seq:${seq}`);

    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      messageBytes,
      additionalData,
      null,
      nonce,
      this.txKey
    );

    return {
      seq,
      nonce: sodium.to_base64(nonce),
      ciphertext: sodium.to_base64(ciphertext),
    };
  }

  public decrypt(packet: EncryptedPacket): string {
    if (packet.seq <= this.lastInboundSeq) {
      throw new Error(
        `Replay detected: invalid sequence number ${packet.seq} <= last seen ${this.lastInboundSeq}`
      );
    }

    let decryptedBytes: Uint8Array;
    try {
      const nonceBytes = sodium.from_base64(packet.nonce);
      const ciphertextBytes = sodium.from_base64(packet.ciphertext);
      const additionalData = sodium.from_string(`seq:${packet.seq}`);

      decryptedBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextBytes,
        additionalData,
        nonceBytes,
        this.rxKey
      );
    } catch {
      throw new Error('Decryption failed: tampered ciphertext or invalid key');
    }

    this.lastInboundSeq = packet.seq;
    return sodium.to_string(decryptedBytes);
  }
}
