import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authFetch } from './authClient';
import * as logger from '../logger';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

describe('authFetch', () => {
  const originalFetch = global.fetch;
  let loggedLines: string[];

  beforeEach(() => {
    loggedLines = [];
    vi.spyOn(logger, 'logLine').mockImplementation((line: string) => {
      loggedLines.push(line);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('handles 2xx response and does not log non-2xx error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () => JSON.stringify({ success: true }),
    })) as any;

    const res = await authFetch<{ success: boolean }>('http://localhost:8081/v1/sessions/123/status', {
      method: 'GET',
      authUrl: 'http://localhost:8081',
      laptopId: 'lap-123',
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(loggedLines).toHaveLength(0);
  });

  it('logs non-2xx response with method, url, authServiceUrl, laptopId, status, and truncated body', async () => {
    const errorBody = JSON.stringify({ error: 'unauthorized', reason: 'bad signature' });
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      text: async () => errorBody,
    })) as any;

    const res = await authFetch('http://localhost:8081/v1/sessions', {
      method: 'POST',
      authUrl: 'http://localhost:8081',
      laptopId: 'lap-abc',
      body: JSON.stringify({ laptopId: 'lap-abc', requestedAt: Date.now() }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(res.bodyText).toBe(errorBody);
    expect(loggedLines).toHaveLength(1);
    const log = loggedLines[0];
    expect(log).toContain('method=POST');
    expect(log).toContain('url=http://localhost:8081/v1/sessions');
    expect(log).toContain('authServiceUrl=http://localhost:8081');
    expect(log).toContain('laptopId=lap-abc');
    expect(log).toContain('status=401');
    expect(log).toContain(`body=${errorBody}`);
    // Check it is strictly a single line
    expect(log.split('\n')).toHaveLength(1);
  });

  it('truncates body > 500 characters and removes newlines in log', async () => {
    const longBody = 'A'.repeat(600) + '\nB\nC';
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => longBody,
    })) as any;

    await authFetch('http://localhost:8081/v1/laptops/register', {
      method: 'POST',
      headers: { 'X-Laptop-Id': 'lap-header-456' },
    });

    expect(loggedLines).toHaveLength(1);
    const log = loggedLines[0];
    expect(log).toContain('laptopId=lap-header-456');
    expect(log).toContain('body=' + 'A'.repeat(500) + '...');
    expect(log.split('\n')).toHaveLength(1);
  });

  it('logs network exception on fetch failure', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8081');
    }) as any;

    await expect(
      authFetch('http://localhost:8081/v1/sessions', {
        method: 'POST',
        laptopId: 'lap-fail',
      })
    ).rejects.toThrow('connect ECONNREFUSED');

    expect(loggedLines).toHaveLength(1);
    expect(loggedLines[0]).toContain('error=connect ECONNREFUSED');
    expect(loggedLines[0].split('\n')).toHaveLength(1);
  });
});
