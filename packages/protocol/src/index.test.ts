import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  isMessageEnvelope,
  isFileSnapshotPayload,
  isFilePatchPayload,
  isInjectPromptPayload,
  buildEnvelope,
  parseEnvelope,
  isSnapshotRequestPayload,
  ALL_CAPABILITIES,
} from './index';

// ── isMessageEnvelope ─────────────────────────────────────────────────────────

describe('isMessageEnvelope', () => {
  it('accepts a valid envelope', () => {
    expect(isMessageEnvelope({
      v:       PROTOCOL_VERSION,
      id:      'abc-123',
      ts:      Date.now(),
      type:    'FILE_SNAPSHOT',
      payload: {},
    })).toBe(true);
  });

  it('rejects wrong protocol version', () => {
    expect(isMessageEnvelope({
      v: 99, id: 'x', ts: 0, type: 'PING', payload: {},
    })).toBe(false);
  });

  it('rejects missing payload', () => {
    expect(isMessageEnvelope({
      v: PROTOCOL_VERSION, id: 'x', ts: 0, type: 'PING',
    })).toBe(false);
  });

  it('rejects null', ()  => expect(isMessageEnvelope(null)).toBe(false));
  it('rejects string', () => expect(isMessageEnvelope('hello')).toBe(false));
});

// ── isFileSnapshotPayload ─────────────────────────────────────────────────────

describe('isFileSnapshotPayload', () => {
  const valid = {
    fileName: 'src/main.ts',
    content:  'console.log("hello")',
    encoding: 'utf8' as const,
    seq:      1,
    isDirty:  false,
    gitHead:  true,
    timestamp: Date.now(),
  };

  it('accepts a valid payload',        () => expect(isFileSnapshotPayload(valid)).toBe(true));
  it('accepts gzip+base64 encoding',   () => expect(isFileSnapshotPayload({ ...valid, encoding: 'gzip+base64' })).toBe(true));
  it('rejects invalid encoding',       () => expect(isFileSnapshotPayload({ ...valid, encoding: 'ascii' })).toBe(false));
  it('rejects missing fileName',       () => expect(isFileSnapshotPayload({ ...valid, fileName: undefined })).toBe(false));
  it('rejects non-number seq',         () => expect(isFileSnapshotPayload({ ...valid, seq: '1' })).toBe(false));
});

// ── isFilePatchPayload ────────────────────────────────────────────────────────

describe('isFilePatchPayload', () => {
  const valid = {
    fileName: 'src/main.ts',
    patches:  '@@ -1,4 +1,5 @@\n hello\n+world\n',
    fromSeq:  1,
    toSeq:    2,
    isDirty:  true,
    timestamp: Date.now(),
  };

  it('accepts a valid payload',  () => expect(isFilePatchPayload(valid)).toBe(true));
  it('rejects missing patches',  () => expect(isFilePatchPayload({ ...valid, patches: undefined })).toBe(false));
  it('rejects string fromSeq',   () => expect(isFilePatchPayload({ ...valid, fromSeq: '1' })).toBe(false));
  it('rejects null',             () => expect(isFilePatchPayload(null)).toBe(false));
});

// ── isInjectPromptPayload ─────────────────────────────────────────────────────

describe('isInjectPromptPayload', () => {
  it('accepts a valid payload',   () => expect(isInjectPromptPayload({ prompt: 'Refactor this' })).toBe(true));
  it('accepts optional fields',   () => expect(isInjectPromptPayload({ prompt: 'x', targetFile: 'src/a.ts' })).toBe(true));
  it('rejects empty prompt',      () => expect(isInjectPromptPayload({ prompt: '' })).toBe(false));
  it('rejects missing prompt',    () => expect(isInjectPromptPayload({})).toBe(false));
});

// ── isSnapshotRequestPayload ─────────────────────────────────────────────────────
describe('isSnapshotRequestPayload', () => {
  it('accepts valid payload',      () => expect(isSnapshotRequestPayload({ fileName: 'a.ts', reason: 'gap' })).toBe(true));
  it('accepts all reason values',  () => {
    expect(isSnapshotRequestPayload({ fileName: 'a.ts', reason: 'corruption' })).toBe(true);
    expect(isSnapshotRequestPayload({ fileName: 'a.ts', reason: 'reconnect' })).toBe(true);
  });
  it('rejects invalid reason',     () => expect(isSnapshotRequestPayload({ fileName: 'a.ts', reason: 'unknown' })).toBe(false));
  it('rejects empty fileName',     () => expect(isSnapshotRequestPayload({ fileName: '', reason: 'gap' })).toBe(false));
  it('rejects null',               () => expect(isSnapshotRequestPayload(null)).toBe(false));
});

// ── buildEnvelope ─────────────────────────────────────────────────────────────

describe('buildEnvelope', () => {
  it('produces a valid envelope', () => {
    const env = buildEnvelope('PING', { source: 'host' });
    expect(env.v).toBe(PROTOCOL_VERSION);
    expect(env.type).toBe('PING');
    expect(env.payload).toEqual({ source: 'host' });
    expect(typeof env.id).toBe('string');
    expect(typeof env.ts).toBe('number');
    expect(typeof env.seq).toBe('number');
  });

  it('increments seq on each call', () => {
    const a = buildEnvelope('PING', { source: 'host' });
    const b = buildEnvelope('PING', { source: 'client' });
    expect(b.seq).toBeGreaterThan(a.seq!);
  });

  it('includes ack when provided', () => {
    const env = buildEnvelope('PONG', { originalId: 'abc' }, { ack: 'abc' });
    expect(env.ack).toBe('abc');
  });

  it('omits ack when not provided', () => {
    const env = buildEnvelope('PING', { source: 'host' });
    expect(env.ack).toBeUndefined();
  });
});

// ── parseEnvelope ─────────────────────────────────────────────────────────────

describe('parseEnvelope', () => {
  it('parses a valid JSON envelope', () => {
    const env = buildEnvelope('EDITOR_FOCUS', { fileName: 'a.ts', cursorLine: 5, cursorCol: 3 });
    const json = JSON.stringify(env);
    const parsed = parseEnvelope(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('EDITOR_FOCUS');
  });

  it('returns null for malformed JSON', () => {
    expect(parseEnvelope('not json')).toBeNull();
  });

  it('returns null for valid JSON but invalid envelope', () => {
    expect(parseEnvelope(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });
});

// ── ALL_CAPABILITIES ──────────────────────────────────────────────────────────

describe('ALL_CAPABILITIES', () => {
  it('includes all expected capabilities', () => {
    expect(ALL_CAPABILITIES).toContain('diff:snapshot');
    expect(ALL_CAPABILITIES).toContain('diff:patch');
    expect(ALL_CAPABILITIES).toContain('prompt:inject');
    expect(ALL_CAPABILITIES).toContain('session:revoke');
  });
});