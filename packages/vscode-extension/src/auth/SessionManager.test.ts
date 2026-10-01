import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from './SessionManager';
import { KeyManager } from './KeyManager';
import { LaptopIdentity } from './LaptopIdentity';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: string) => defaultValue),
    })),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

describe('SessionManager Auto-Recovery', () => {
  let mockKeyManager: KeyManager;
  let mockLaptopIdentity: LaptopIdentity;
  let sessionManager: SessionManager;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockKeyManager = {
      signRequest: vi.fn(async () => 'fake-sig'),
      getOrCreateKeyPair: vi.fn(async () => ({
        privateKeyPem: 'fake-priv',
        publicKeyPem: 'fake-pub',
      })),
      getPublicKeyPem: vi.fn(async () => 'fake-pub'),
      clearKeys: vi.fn(async () => {}),
    } as unknown as KeyManager;

    mockLaptopIdentity = {
      ensureRegistered: vi.fn(async () => 'lap-initial-123'),
      reRegister: vi.fn(async () => 'lap-recovered-456'),
      resetIdentity: vi.fn(async () => {}),
      clearIdentity: vi.fn(async () => {}),
      getLaptopId: vi.fn(() => 'lap-initial-123'),
      getStoredAuthUrl: vi.fn(() => 'http://localhost:8081'),
    } as unknown as LaptopIdentity;

    sessionManager = new SessionManager(mockKeyManager, 'lap-initial-123', mockLaptopIdentity);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('creates session successfully on first attempt', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          sessionId: 'sess_1',
          qrPayload: 'qr_1',
          expiresAt: Date.now() + 90000,
        }),
    })) as any;

    const res = await sessionManager.createSession();
    expect(res.sessionId).toBe('sess_1');
    expect(sessionManager.state).toBe('pending');
    expect(mockLaptopIdentity.reRegister).not.toHaveBeenCalled();
  });

  it('auto-recovers when POST /v1/sessions returns 401 with reason laptop not found', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (url: string, options: any) => {
      callCount++;
      if (callCount === 1) {
        // First call with old laptopId fails with 401 laptop not found
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers(),
          text: async () => JSON.stringify({ error: 'unknown laptop', reason: 'laptop not found' }),
        };
      }
      // Second call after re-registration succeeds
      return {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            sessionId: 'sess_recovered',
            qrPayload: 'qr_recovered',
            expiresAt: Date.now() + 90000,
          }),
      };
    });
    global.fetch = fetchMock as any;

    const res = await sessionManager.createSession();
    expect(res.sessionId).toBe('sess_recovered');
    expect(mockLaptopIdentity.reRegister).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Verify second call used the new recovered laptop ID
    const secondCallHeaders = fetchMock.mock.calls[1][1].headers;
    expect(secondCallHeaders['X-Laptop-Id']).toBe('lap-recovered-456');
  });

  it('does NOT auto-recover if 401 reason is not laptop not found', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      text: async () =>
        JSON.stringify({ error: 'signature verification failed', reason: 'bad signature' }),
    })) as any;

    await expect(sessionManager.createSession()).rejects.toThrow(
      'Session creation failed (401): {"error":"signature verification failed","reason":"bad signature"}'
    );
    expect(mockLaptopIdentity.reRegister).not.toHaveBeenCalled();
  });

  it('does not retry indefinitely if retry also returns 401 laptop not found', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      text: async () => JSON.stringify({ error: 'unknown laptop', reason: 'laptop not found' }),
    })) as any;

    await expect(sessionManager.createSession()).rejects.toThrow(
      'Session creation failed (401): {"error":"unknown laptop","reason":"laptop not found"}'
    );
    expect(mockLaptopIdentity.reRegister).toHaveBeenCalledTimes(1);
  });
});
