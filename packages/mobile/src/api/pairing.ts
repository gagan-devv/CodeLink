export interface PairingPayload {
  sessionId: string;
  challenge: string;
  relayWss?: string;
}

/**
 * Decodes a CodeLink pairing payload string from a QR scan or manual paste.
 *
 * Supports:
 * - URL-safe base64 encoded JSON (with or without padding)
 * - Standard base64 encoded JSON (with or without padding)
 * - Raw JSON string
 * - Backward compatibility with legacy payloads containing relayWss or relayWSS
 *
 * Throws an Error with a descriptive message if the payload is invalid or missing required fields.
 */
export function decodePairingPayload(raw: string): PairingPayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Pairing code cannot be empty');
  }

  let jsonStr = '';

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    jsonStr = trimmed;
  } else {
    try {
      const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      if (typeof atob === 'function') {
        jsonStr = atob(padded);
      } else if (typeof Buffer !== 'undefined') {
        jsonStr = Buffer.from(padded, 'base64').toString('utf8');
      } else {
        throw new Error('No base64 decoder available');
      }
    } catch (e) {
      throw new Error(
        `Invalid pairing code format: ${e instanceof Error ? e.message : 'Invalid encoding'}`
      );
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Invalid pairing code: malformed JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid pairing code payload');
  }

  const obj = parsed as Record<string, unknown>;
  const sessionId = typeof obj.sessionId === 'string' ? obj.sessionId.trim() : undefined;
  const challenge = typeof obj.challenge === 'string' ? obj.challenge.trim() : undefined;
  const relayWss =
    typeof obj.relayWss === 'string'
      ? obj.relayWss.trim()
      : typeof obj.relayWSS === 'string'
        ? obj.relayWSS.trim()
        : undefined;

  if (!sessionId || !challenge) {
    throw new Error('Invalid pairing code: missing sessionId or challenge');
  }

  return {
    sessionId,
    challenge,
    ...(relayWss ? { relayWss } : {}),
  };
}
