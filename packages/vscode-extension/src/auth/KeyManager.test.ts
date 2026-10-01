import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyManager } from './KeyManager';
import { createVerify } from 'crypto';

describe('KeyManager', () => {
  let secretsMap: Map<string, string>;
  let mockSecrets: any;
  let keyManager: KeyManager;

  beforeEach(() => {
    secretsMap = new Map();
    mockSecrets = {
      get: vi.fn(async (key: string) => secretsMap.get(key)),
      store: vi.fn(async (key: string, value: string) => {
        secretsMap.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        secretsMap.delete(key);
      }),
      onDidChange: vi.fn(),
    };
    keyManager = new KeyManager(mockSecrets);
  });

  it('generates and persists RSA key pair on first call', async () => {
    const keys = await keyManager.getOrCreateKeyPair();
    expect(keys.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(keys.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(mockSecrets.store).toHaveBeenCalledTimes(2);
    expect(secretsMap.get('codelink.rsa.privateKey')).toBe(keys.privateKeyPem);
    expect(secretsMap.get('codelink.rsa.publicKey')).toBe(keys.publicKeyPem);

    // Second call should return cached keys without generating new ones
    const cached = await keyManager.getOrCreateKeyPair();
    expect(cached.privateKeyPem).toBe(keys.privateKeyPem);
    expect(cached.publicKeyPem).toBe(keys.publicKeyPem);
    expect(mockSecrets.store).toHaveBeenCalledTimes(2);
  });

  it('getPublicKeyPem returns public key string', async () => {
    const pub = await keyManager.getPublicKeyPem();
    expect(pub).toContain('BEGIN PUBLIC KEY');
  });

  it('signs request body with private key', async () => {
    const body = JSON.stringify({ message: 'hello world' });
    const sig = await keyManager.signRequest(body);
    const pub = await keyManager.getPublicKeyPem();

    const verifier = createVerify('SHA256');
    verifier.update(body);
    const isValid = verifier.verify(pub, sig, 'base64');
    expect(isValid).toBe(true);
  });

  it('clearKeys deletes both keys from SecretStorage', async () => {
    const initialKeys = await keyManager.getOrCreateKeyPair();
    expect(secretsMap.has('codelink.rsa.privateKey')).toBe(true);
    expect(secretsMap.has('codelink.rsa.publicKey')).toBe(true);

    await keyManager.clearKeys();
    expect(mockSecrets.delete).toHaveBeenCalledWith('codelink.rsa.privateKey');
    expect(mockSecrets.delete).toHaveBeenCalledWith('codelink.rsa.publicKey');
    expect(secretsMap.has('codelink.rsa.privateKey')).toBe(false);
    expect(secretsMap.has('codelink.rsa.publicKey')).toBe(false);

    // Subsequent call should generate a fresh keypair
    const newKeys = await keyManager.getOrCreateKeyPair();
    expect(newKeys.publicKeyPem).not.toBe(initialKeys.publicKeyPem);
  });
});
