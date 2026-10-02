import { describe, it, expect } from 'vitest';
import { decodePairingPayload } from './pairing';

describe('decodePairingPayload', () => {
  function toBase64Url(obj: object): string {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function toBase64Standard(obj: object, padded = true): string {
    const b64 = Buffer.from(JSON.stringify(obj)).toString('base64');
    return padded ? b64 : b64.replace(/=+$/, '');
  }

  it('decodes minimal URL-safe base64 payload with sessionId and challenge', () => {
    const input = toBase64Url({
      sessionId: 'sess_12345',
      challenge: 'chal_abcde',
    });

    const result = decodePairingPayload(input);
    expect(result).toEqual({
      sessionId: 'sess_12345',
      challenge: 'chal_abcde',
    });
  });

  it('is backward compatible with legacy payload containing relayWSS', () => {
    const input = toBase64Url({
      sessionId: 'sess_12345',
      challenge: 'chal_abcde',
      relayWSS: 'ws://localhost:8082/ws',
    });

    const result = decodePairingPayload(input);
    expect(result).toEqual({
      sessionId: 'sess_12345',
      challenge: 'chal_abcde',
      relayWss: 'ws://localhost:8082/ws',
    });
  });

  it('is backward compatible with legacy payload containing relayWss (lowercase)', () => {
    const input = toBase64Url({
      sessionId: 'sess_999',
      challenge: 'chal_888',
      relayWss: 'wss://relay.example.com',
    });

    const result = decodePairingPayload(input);
    expect(result).toEqual({
      sessionId: 'sess_999',
      challenge: 'chal_888',
      relayWss: 'wss://relay.example.com',
    });
  });

  it('decodes standard base64 payload (with and without padding)', () => {
    const obj = { sessionId: 'sess_std', challenge: 'chal_std' };
    const padded = toBase64Standard(obj, true);
    const unpadded = toBase64Standard(obj, false);

    expect(decodePairingPayload(padded)).toEqual(obj);
    expect(decodePairingPayload(unpadded)).toEqual(obj);
  });

  it('decodes raw JSON string directly', () => {
    const rawJson = JSON.stringify({
      sessionId: 'sess_raw_json',
      challenge: 'chal_raw_json',
    });

    const result = decodePairingPayload(rawJson);
    expect(result).toEqual({
      sessionId: 'sess_raw_json',
      challenge: 'chal_raw_json',
    });
  });

  it('trims leading and trailing whitespace', () => {
    const input = `   ${toBase64Url({
      sessionId: 'sess_trimmed',
      challenge: 'chal_trimmed',
    })}   \n`;

    const result = decodePairingPayload(input);
    expect(result).toEqual({
      sessionId: 'sess_trimmed',
      challenge: 'chal_trimmed',
    });
  });

  it('throws descriptive error on empty or whitespace input', () => {
    expect(() => decodePairingPayload('')).toThrow('Pairing code cannot be empty');
    expect(() => decodePairingPayload('   \n  ')).toThrow('Pairing code cannot be empty');
  });

  it('throws descriptive error on invalid base64 encoding', () => {
    expect(() => decodePairingPayload('!!!not-base64???')).toThrow('Invalid pairing code');
  });

  it('throws descriptive error on malformed JSON payload', () => {
    const malformedB64 = Buffer.from('{ broken json: ').toString('base64');
    expect(() => decodePairingPayload(malformedB64)).toThrow('Invalid pairing code: malformed JSON');
  });

  it('throws descriptive error on non-object JSON payload', () => {
    const arrayB64 = Buffer.from('[1, 2, 3]').toString('base64');
    expect(() => decodePairingPayload(arrayB64)).toThrow('Invalid pairing code payload');

    const stringB64 = Buffer.from('"just a string"').toString('base64');
    expect(() => decodePairingPayload(stringB64)).toThrow('Invalid pairing code payload');
  });

  it('throws descriptive error when sessionId or challenge is missing', () => {
    const noSession = toBase64Url({ challenge: 'chal_only' });
    expect(() => decodePairingPayload(noSession)).toThrow('missing sessionId or challenge');

    const noChallenge = toBase64Url({ sessionId: 'sess_only' });
    expect(() => decodePairingPayload(noChallenge)).toThrow('missing sessionId or challenge');

    const emptySession = toBase64Url({ sessionId: '', challenge: 'chal_ok' });
    expect(() => decodePairingPayload(emptySession)).toThrow('missing sessionId or challenge');
  });
});
