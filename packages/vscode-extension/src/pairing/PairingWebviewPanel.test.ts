import { describe, it, expect, vi } from 'vitest';
import { shortenPairingPayload } from './PairingWebviewPanel';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
  window: {
    createWebviewPanel: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
}));

describe('shortenPairingPayload', () => {
  function toBase64Url(obj: object): string {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function fromBase64Url(str: string): any {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  }

  it('drops relayWSS and extra fields from legacy URL-safe base64 payload', () => {
    const legacy = toBase64Url({
      sessionId: 'sess_12345',
      challenge: 'chal_67890',
      relayWSS: 'ws://localhost:8082/ws',
      extraField: 'should_be_dropped',
    });

    const shortened = shortenPairingPayload(legacy);
    const decoded = fromBase64Url(shortened);

    expect(decoded).toEqual({
      sessionId: 'sess_12345',
      challenge: 'chal_67890',
    });
    expect(decoded.relayWSS).toBeUndefined();
    expect(decoded.extraField).toBeUndefined();
  });

  it('preserves minimal payload structure with only sessionId and challenge', () => {
    const minimal = toBase64Url({
      sessionId: 'sess_abc',
      challenge: 'chal_xyz',
    });

    const result = shortenPairingPayload(minimal);
    const decoded = fromBase64Url(result);

    expect(decoded).toEqual({
      sessionId: 'sess_abc',
      challenge: 'chal_xyz',
    });
  });

  it('handles raw JSON string and converts it to minimal base64url payload', () => {
    const rawJson = JSON.stringify({
      sessionId: 'sess_raw',
      challenge: 'chal_raw',
      relayWss: 'wss://relay.example.com',
    });

    const result = shortenPairingPayload(rawJson);
    const decoded = fromBase64Url(result);

    expect(decoded).toEqual({
      sessionId: 'sess_raw',
      challenge: 'chal_raw',
    });
  });

  it('falls back to original string when payload is invalid base64 / non-JSON', () => {
    const invalid = 'not-valid-base64-or-json!@#$';
    expect(shortenPairingPayload(invalid)).toBe(invalid);
  });

  it('falls back to original string when sessionId or challenge is missing', () => {
    const missingSessionId = toBase64Url({
      challenge: 'chal_only',
    });
    expect(shortenPairingPayload(missingSessionId)).toBe(missingSessionId);

    const missingChallenge = toBase64Url({
      sessionId: 'sess_only',
    });
    expect(shortenPairingPayload(missingChallenge)).toBe(missingChallenge);
  });
});
