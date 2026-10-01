import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LaptopIdentity } from './LaptopIdentity';
import { KeyManager } from './KeyManager';

let mockAuthUrl = 'http://localhost:8081';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'authServiceUrl') {
          return mockAuthUrl;
        }
        return defaultValue;
      }),
    })),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

describe('LaptopIdentity', () => {
  let stateMap: Map<string, any>;
  let mockGlobalState: any;
  let mockKeyManager: any;
  let laptopIdentity: LaptopIdentity;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockAuthUrl = 'http://localhost:8081';
    stateMap = new Map();
    mockGlobalState = {
      get: vi.fn((key: string, defaultValue?: any) =>
        stateMap.has(key) ? stateMap.get(key) : defaultValue
      ),
      update: vi.fn(async (key: string, value: any) => {
        if (value === undefined) {
          stateMap.delete(key);
        } else {
          stateMap.set(key, value);
        }
      }),
      keys: vi.fn(() => Array.from(stateMap.keys())),
    };

    mockKeyManager = {
      getPublicKeyPem: vi.fn(async () => 'fake-public-key-pem'),
      clearKeys: vi.fn(async () => {}),
    };

    laptopIdentity = new LaptopIdentity(mockKeyManager as KeyManager, mockGlobalState);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns cached laptopId if already present in globalState and url unchanged', async () => {
    stateMap.set('codelink.laptopId', 'laptop-123');
    stateMap.set('codelink.authServiceUrl', 'http://localhost:8081');
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const id = await laptopIdentity.ensureRegistered();
    expect(id).toBe('laptop-123');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers with auth service and saves laptopId and authServiceUrl when not cached', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ laptopId: 'laptop-new-456' }),
    }));
    global.fetch = fetchMock as any;

    const id = await laptopIdentity.ensureRegistered();
    expect(id).toBe('laptop-new-456');
    expect(mockKeyManager.getPublicKeyPem).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8081/v1/laptops/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKeyPem: 'fake-public-key-pem' }),
    });
    expect(stateMap.get('codelink.laptopId')).toBe('laptop-new-456');
    expect(stateMap.get('codelink.authServiceUrl')).toBe('http://localhost:8081');
    expect(laptopIdentity.getStoredAuthUrl()).toBe('http://localhost:8081');
  });

  it('automatically resets identity and re-registers if authServiceUrl changed', async () => {
    stateMap.set('codelink.laptopId', 'laptop-local-old');
    stateMap.set('codelink.authServiceUrl', 'http://localhost:8081');

    // Simulate user pointing extension to new auth URL
    mockAuthUrl = 'https://auth.example.com';

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ laptopId: 'laptop-remote-new' }),
    }));
    global.fetch = fetchMock as any;

    const id = await laptopIdentity.ensureRegistered();
    expect(mockKeyManager.clearKeys).toHaveBeenCalled();
    expect(id).toBe('laptop-remote-new');
    expect(stateMap.get('codelink.laptopId')).toBe('laptop-remote-new');
    expect(stateMap.get('codelink.authServiceUrl')).toBe('https://auth.example.com');
  });

  it('resetIdentity clears laptopId, authServiceUrl, and keypair', async () => {
    stateMap.set('codelink.laptopId', 'laptop-123');
    stateMap.set('codelink.authServiceUrl', 'http://localhost:8081');
    expect(laptopIdentity.getLaptopId()).toBe('laptop-123');
    expect(laptopIdentity.getStoredAuthUrl()).toBe('http://localhost:8081');

    await laptopIdentity.resetIdentity();
    expect(mockGlobalState.update).toHaveBeenCalledWith('codelink.laptopId', undefined);
    expect(mockGlobalState.update).toHaveBeenCalledWith('codelink.authServiceUrl', undefined);
    expect(mockKeyManager.clearKeys).toHaveBeenCalled();
    expect(stateMap.has('codelink.laptopId')).toBe(false);
    expect(stateMap.has('codelink.authServiceUrl')).toBe(false);
    expect(laptopIdentity.getLaptopId()).toBeUndefined();
    expect(laptopIdentity.getStoredAuthUrl()).toBeUndefined();
  });

  it('reRegister resets state and keys, then registers fresh', async () => {
    stateMap.set('codelink.laptopId', 'laptop-old-789');

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ laptopId: 'laptop-fresh-999' }),
    }));
    global.fetch = fetchMock as any;

    const newId = await laptopIdentity.reRegister();
    expect(mockKeyManager.clearKeys).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(newId).toBe('laptop-fresh-999');
    expect(stateMap.get('codelink.laptopId')).toBe('laptop-fresh-999');
    expect(laptopIdentity.getLaptopId()).toBe('laptop-fresh-999');
  });

  it('throws an error if registration fails on server error', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));
    global.fetch = fetchMock as any;

    await expect(laptopIdentity.reRegister()).rejects.toThrow('Laptop registration failed (500)');
  });
});
