"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
// ── isMessageEnvelope ─────────────────────────────────────────────────────────
(0, vitest_1.describe)('isMessageEnvelope', () => {
    (0, vitest_1.it)('accepts a valid envelope', () => {
        (0, vitest_1.expect)((0, index_1.isMessageEnvelope)({
            v: index_1.PROTOCOL_VERSION,
            id: 'abc-123',
            ts: Date.now(),
            type: 'FILE_SNAPSHOT',
            payload: {},
        })).toBe(true);
    });
    (0, vitest_1.it)('rejects wrong protocol version', () => {
        (0, vitest_1.expect)((0, index_1.isMessageEnvelope)({
            v: 99, id: 'x', ts: 0, type: 'PING', payload: {},
        })).toBe(false);
    });
    (0, vitest_1.it)('rejects missing payload', () => {
        (0, vitest_1.expect)((0, index_1.isMessageEnvelope)({
            v: index_1.PROTOCOL_VERSION, id: 'x', ts: 0, type: 'PING',
        })).toBe(false);
    });
    (0, vitest_1.it)('rejects null', () => (0, vitest_1.expect)((0, index_1.isMessageEnvelope)(null)).toBe(false));
    (0, vitest_1.it)('rejects string', () => (0, vitest_1.expect)((0, index_1.isMessageEnvelope)('hello')).toBe(false));
});
// ── isFileSnapshotPayload ─────────────────────────────────────────────────────
(0, vitest_1.describe)('isFileSnapshotPayload', () => {
    const valid = {
        fileName: 'src/main.ts',
        content: 'console.log("hello")',
        encoding: 'utf8',
        seq: 1,
        isDirty: false,
        gitHead: true,
        timestamp: Date.now(),
    };
    (0, vitest_1.it)('accepts a valid payload', () => (0, vitest_1.expect)((0, index_1.isFileSnapshotPayload)(valid)).toBe(true));
    (0, vitest_1.it)('accepts gzip+base64 encoding', () => (0, vitest_1.expect)((0, index_1.isFileSnapshotPayload)({ ...valid, encoding: 'gzip+base64' })).toBe(true));
    (0, vitest_1.it)('rejects invalid encoding', () => (0, vitest_1.expect)((0, index_1.isFileSnapshotPayload)({ ...valid, encoding: 'ascii' })).toBe(false));
    (0, vitest_1.it)('rejects missing fileName', () => (0, vitest_1.expect)((0, index_1.isFileSnapshotPayload)({ ...valid, fileName: undefined })).toBe(false));
    (0, vitest_1.it)('rejects non-number seq', () => (0, vitest_1.expect)((0, index_1.isFileSnapshotPayload)({ ...valid, seq: '1' })).toBe(false));
});
// ── isFilePatchPayload ────────────────────────────────────────────────────────
(0, vitest_1.describe)('isFilePatchPayload', () => {
    const valid = {
        fileName: 'src/main.ts',
        patches: '@@ -1,4 +1,5 @@\n hello\n+world\n',
        fromSeq: 1,
        toSeq: 2,
        isDirty: true,
        timestamp: Date.now(),
    };
    (0, vitest_1.it)('accepts a valid payload', () => (0, vitest_1.expect)((0, index_1.isFilePatchPayload)(valid)).toBe(true));
    (0, vitest_1.it)('rejects missing patches', () => (0, vitest_1.expect)((0, index_1.isFilePatchPayload)({ ...valid, patches: undefined })).toBe(false));
    (0, vitest_1.it)('rejects string fromSeq', () => (0, vitest_1.expect)((0, index_1.isFilePatchPayload)({ ...valid, fromSeq: '1' })).toBe(false));
    (0, vitest_1.it)('rejects null', () => (0, vitest_1.expect)((0, index_1.isFilePatchPayload)(null)).toBe(false));
});
// ── isInjectPromptPayload ─────────────────────────────────────────────────────
(0, vitest_1.describe)('isInjectPromptPayload', () => {
    (0, vitest_1.it)('accepts a valid payload', () => (0, vitest_1.expect)((0, index_1.isInjectPromptPayload)({ prompt: 'Refactor this' })).toBe(true));
    (0, vitest_1.it)('accepts optional fields', () => (0, vitest_1.expect)((0, index_1.isInjectPromptPayload)({ prompt: 'x', targetFile: 'src/a.ts' })).toBe(true));
    (0, vitest_1.it)('rejects empty prompt', () => (0, vitest_1.expect)((0, index_1.isInjectPromptPayload)({ prompt: '' })).toBe(false));
    (0, vitest_1.it)('rejects missing prompt', () => (0, vitest_1.expect)((0, index_1.isInjectPromptPayload)({})).toBe(false));
});
// ── isSnapshotRequestPayload ─────────────────────────────────────────────────────
(0, vitest_1.describe)('isSnapshotRequestPayload', () => {
    (0, vitest_1.it)('accepts valid payload', () => (0, vitest_1.expect)((0, index_1.isSnapshotRequestPayload)({ fileName: 'a.ts', reason: 'gap' })).toBe(true));
    (0, vitest_1.it)('accepts all reason values', () => {
        (0, vitest_1.expect)((0, index_1.isSnapshotRequestPayload)({ fileName: 'a.ts', reason: 'corruption' })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSnapshotRequestPayload)({ fileName: 'a.ts', reason: 'reconnect' })).toBe(true);
    });
    (0, vitest_1.it)('rejects invalid reason', () => (0, vitest_1.expect)((0, index_1.isSnapshotRequestPayload)({ fileName: 'a.ts', reason: 'unknown' })).toBe(false));
    (0, vitest_1.it)('rejects empty fileName', () => (0, vitest_1.expect)((0, index_1.isSnapshotRequestPayload)({ fileName: '', reason: 'gap' })).toBe(false));
    (0, vitest_1.it)('rejects null', () => (0, vitest_1.expect)((0, index_1.isSnapshotRequestPayload)(null)).toBe(false));
});
// ── buildEnvelope ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)('buildEnvelope', () => {
    (0, vitest_1.it)('produces a valid envelope', () => {
        const env = (0, index_1.buildEnvelope)('PING', { source: 'host' });
        (0, vitest_1.expect)(env.v).toBe(index_1.PROTOCOL_VERSION);
        (0, vitest_1.expect)(env.type).toBe('PING');
        (0, vitest_1.expect)(env.payload).toEqual({ source: 'host' });
        (0, vitest_1.expect)(typeof env.id).toBe('string');
        (0, vitest_1.expect)(typeof env.ts).toBe('number');
        (0, vitest_1.expect)(typeof env.seq).toBe('number');
    });
    (0, vitest_1.it)('increments seq on each call', () => {
        const a = (0, index_1.buildEnvelope)('PING', { source: 'host' });
        const b = (0, index_1.buildEnvelope)('PING', { source: 'client' });
        (0, vitest_1.expect)(b.seq).toBeGreaterThan(a.seq);
    });
    (0, vitest_1.it)('includes ack when provided', () => {
        const env = (0, index_1.buildEnvelope)('PONG', { originalId: 'abc' }, { ack: 'abc' });
        (0, vitest_1.expect)(env.ack).toBe('abc');
    });
    (0, vitest_1.it)('omits ack when not provided', () => {
        const env = (0, index_1.buildEnvelope)('PING', { source: 'host' });
        (0, vitest_1.expect)(env.ack).toBeUndefined();
    });
});
// ── parseEnvelope ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)('parseEnvelope', () => {
    (0, vitest_1.it)('parses a valid JSON envelope', () => {
        const env = (0, index_1.buildEnvelope)('EDITOR_FOCUS', { fileName: 'a.ts', cursorLine: 5, cursorCol: 3 });
        const json = JSON.stringify(env);
        const parsed = (0, index_1.parseEnvelope)(json);
        (0, vitest_1.expect)(parsed).not.toBeNull();
        (0, vitest_1.expect)(parsed?.type).toBe('EDITOR_FOCUS');
    });
    (0, vitest_1.it)('returns null for malformed JSON', () => {
        (0, vitest_1.expect)((0, index_1.parseEnvelope)('not json')).toBeNull();
    });
    (0, vitest_1.it)('returns null for valid JSON but invalid envelope', () => {
        (0, vitest_1.expect)((0, index_1.parseEnvelope)(JSON.stringify({ foo: 'bar' }))).toBeNull();
    });
});
// ── ALL_CAPABILITIES ──────────────────────────────────────────────────────────
(0, vitest_1.describe)('ALL_CAPABILITIES', () => {
    (0, vitest_1.it)('includes all expected capabilities', () => {
        (0, vitest_1.expect)(index_1.ALL_CAPABILITIES).toContain('diff:snapshot');
        (0, vitest_1.expect)(index_1.ALL_CAPABILITIES).toContain('diff:patch');
        (0, vitest_1.expect)(index_1.ALL_CAPABILITIES).toContain('prompt:inject');
        (0, vitest_1.expect)(index_1.ALL_CAPABILITIES).toContain('session:revoke');
    });
});
//# sourceMappingURL=index.test.js.map