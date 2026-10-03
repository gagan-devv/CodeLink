import { x25519 } from '@noble/curves/ed25519';
import { blake2b } from '@noble/hashes/blake2b';
import { secureRandomBytes } from './random';

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SessionKeys {
  sharedRx: Uint8Array;
  sharedTx: Uint8Array;
}

export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let b64: string;
  if (typeof btoa === 'function') {
    b64 = btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(bytes).toString('base64');
  } else {
    throw new Error('No base64 encoder available');
  }
  // Libsodium default variant is URLSAFE_NO_PADDING (+ -> -, / -> _, strip =)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64(base64: string): Uint8Array {
  // Convert URLSAFE_NO_PADDING to standard base64 with padding for atob/Buffer
  let std = base64.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = std.length % 4;
  if (remainder > 0) {
    std += '='.repeat(4 - remainder);
  }
  let binary: string;
  if (typeof atob === 'function') {
    binary = atob(std);
  } else if (typeof Buffer !== 'undefined') {
    binary = Buffer.from(std, 'base64').toString('binary');
  } else {
    throw new Error('No base64 decoder available');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeUtf8(str: string): Uint8Array {
  return textEncoder.encode(str);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

/**
 * Generate X25519 keypair using secure CSPRNG.
 */
export function generateKeyPair(): KeyPair {
  const privateKey = secureRandomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Derives client session keys matching libsodium crypto_kx_client_session_keys bit-for-bit:
 * q = scalarmult(clientSk, serverPk)
 * h = blake2b(q || clientPk || serverPk, dkLen=64)
 * sharedRx = h[0..32], sharedTx = h[32..64]
 */
export function nobleKxClient(
  clientPk: Uint8Array,
  clientSk: Uint8Array,
  serverPk: Uint8Array
): SessionKeys {
  const q = x25519.getSharedSecret(clientSk, serverPk);
  const buf = new Uint8Array(96);
  buf.set(q, 0);
  buf.set(clientPk, 32);
  buf.set(serverPk, 64);
  const h = blake2b(buf, { dkLen: 64 });
  return {
    sharedRx: new Uint8Array(h.buffer, h.byteOffset, 32),
    sharedTx: new Uint8Array(h.buffer, h.byteOffset + 32, 32),
  };
}

/**
 * Derives server session keys matching libsodium crypto_kx_server_session_keys bit-for-bit:
 * q = scalarmult(serverSk, clientPk)
 * h = blake2b(q || clientPk || serverPk, dkLen=64)
 * sharedTx = h[0..32], sharedRx = h[32..64]
 */
export function nobleKxServer(
  serverPk: Uint8Array,
  serverSk: Uint8Array,
  clientPk: Uint8Array
): SessionKeys {
  const q = x25519.getSharedSecret(serverSk, clientPk);
  const buf = new Uint8Array(96);
  buf.set(q, 0);
  buf.set(clientPk, 32);
  buf.set(serverPk, 64);
  const h = blake2b(buf, { dkLen: 64 });
  return {
    sharedTx: new Uint8Array(h.buffer, h.byteOffset, 32),
    sharedRx: new Uint8Array(h.buffer, h.byteOffset + 32, 32),
  };
}

/**
 * Computes deterministic Short Authentication String (SAS) matching PairingManager.computeClientSas:
 * hash = blake2b(hostPublicKey || clientPublicKey || code, dkLen=16)
 * sas = toHex(hash).slice(0, 6).toUpperCase()
 */
export function computeClientSas(
  hostPublicKey: Uint8Array,
  clientPublicKey: Uint8Array,
  code: string
): string {
  const codeBytes = encodeUtf8(code);
  const combined = new Uint8Array(hostPublicKey.length + clientPublicKey.length + codeBytes.length);
  combined.set(hostPublicKey, 0);
  combined.set(clientPublicKey, hostPublicKey.length);
  combined.set(codeBytes, hostPublicKey.length + clientPublicKey.length);

  const hash = blake2b(combined, { dkLen: 16 });
  return toHex(hash).slice(0, 6).toUpperCase();
}

/**
 * Computes deterministic device ID matching companion PairedDeviceStore:
 * 'dev-' + toHex(blake2b(clientPublicKey, dkLen=8))
 */
export function computeDeviceId(clientPublicKey: Uint8Array): string {
  const hash = blake2b(clientPublicKey, { dkLen: 8 });
  return `dev-${toHex(hash)}`;
}
