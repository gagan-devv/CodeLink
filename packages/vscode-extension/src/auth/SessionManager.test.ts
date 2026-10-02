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

describe('SessionManager.waitForMobile Polling', () => {
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
    sessionManager.dispose();
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pending twice then active resolves with active session', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    global.fetch = vi.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: async () => JSON.stringify({ state: 'pending', laptopToken: null }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => JSON.stringify({ state: 'active', laptopToken: 'tok_active_xyz' }),
      };
    }) as any;

    const promise = sessionManager.waitForMobile('sess_123');

    // Poll 1 (immediate at t=0)
    await vi.advanceTimersByTimeAsync(0);
    expect(callCount).toBe(1);
    expect(sessionManager.state).toBe('idle');

    // Poll 2 (after 2000ms delay)
    await vi.advanceTimersByTimeAsync(2000);
    expect(callCount).toBe(2);
    expect(sessionManager.state).toBe('idle');

    // Poll 3 (after another 2000ms delay)
    await vi.advanceTimersByTimeAsync(2000);
    expect(callCount).toBe(3);

    const session = await promise;
    expect(session.sessionId).toBe('sess_123');
    expect(session.laptopToken).toBe('tok_active_xyz');
    expect(session.relayWssUrl).toBe('ws://localhost:8082/ws');
    expect(sessionManager.state).toBe('active');
    expect(sessionManager.session).toEqual(session);
  });

  it('deadline rejects with timeout error', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () => JSON.stringify({ state: 'pending', laptopToken: null }),
    })) as any;

    const promise = sessionManager.waitForMobile('sess_123', 90_000);
    const expectPromise = expect(promise).rejects.toThrow('Pairing timed out - QR code expired');

    // Advance 90s (90,000ms)
    await vi.advanceTimersByTimeAsync(90_000);

    await expectPromise;
    expect(sessionManager.state).toBe('idle');
  });

  it('rejects on non-OK status', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: async () => JSON.stringify({ error: 'session not found' }),
    })) as any;

    await expect(sessionManager.waitForMobile('sess_123')).rejects.toThrow(
      'Status poll failed (404): {"error":"session not found"}'
    );
  });

  it('clears poll timer on dispose', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    global.fetch = vi.fn(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => JSON.stringify({ state: 'pending', laptopToken: null }),
      };
    }) as any;

    sessionManager.waitForMobile('sess_123').catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(callCount).toBe(1);

    sessionManager.dispose();

    await vi.advanceTimersByTimeAsync(5000);
    expect(callCount).toBe(1);
  });
});
