import { logLine } from '../logger';

export interface AuthFetchOptions extends RequestInit {
  authUrl?: string;
  laptopId?: string;
}

export interface AuthFetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  bodyText: string;
  json(): Promise<T>;
}

/**
 * Wraps all HTTP calls to the auth service.
 * Logs method, full URL, status, response body (truncated to 500 chars),
 * laptopId, and authServiceUrl on any non-2xx response.
 * Strictly one line per event, with no secrets logged.
 */
export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<AuthFetchResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  const fullUrl = url;

  let authUrl = options.authUrl;
  if (!authUrl) {
    try {
      authUrl = new URL(url).origin;
    } catch {
      authUrl = '(unknown)';
    }
  }

  let laptopId = options.laptopId;
  if (!laptopId) {
    const headers = options.headers as Record<string, string> | undefined;
    if (headers && typeof headers === 'object') {
      laptopId = headers['X-Laptop-Id'] || headers['x-laptop-id'];
    }
  }
  if (!laptopId) {
    laptopId = '(none)';
  }

  let response: Response;
  const fetchOptions: RequestInit = {
    method: options.method,
    headers: options.headers,
    body: options.body,
    mode: options.mode,
    credentials: options.credentials,
    cache: options.cache,
    redirect: options.redirect,
    referrer: options.referrer,
    referrerPolicy: options.referrerPolicy,
    integrity: options.integrity,
    keepalive: options.keepalive,
    signal: options.signal,
  };
  try {
    response = await fetch(url, fetchOptions);
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logLine(
      `[ERROR] Auth HTTP request failed: method=${method} url=${fullUrl} authServiceUrl=${authUrl} laptopId=${laptopId} error=${errMessage}`
    );
    throw err;
  }

  let rawBody = '';
  if (typeof response.text === 'function') {
    rawBody = await response.text();
  } else if (
    'json' in response &&
    typeof (response as { json: () => Promise<unknown> }).json === 'function'
  ) {
    rawBody = JSON.stringify(await (response as { json: () => Promise<unknown> }).json());
  }

  if (!response.ok) {
    const truncatedBody = rawBody.length > 500 ? rawBody.slice(0, 500) + '...' : rawBody;
    const singleLineBody = truncatedBody.replace(/[\r\n]+/g, ' ');
    logLine(
      `[ERROR] Auth HTTP request failed: method=${method} url=${fullUrl} authServiceUrl=${authUrl} laptopId=${laptopId} status=${response.status} body=${singleLineBody}`
    );
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    bodyText: rawBody,
    json: async () => {
      if (!rawBody) {
        return {} as T;
      }
      return JSON.parse(rawBody) as T;
    },
  };
}
