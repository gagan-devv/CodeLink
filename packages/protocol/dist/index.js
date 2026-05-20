"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_CAPABILITIES = exports.PROTOCOL_VERSION = void 0;
exports.isMessageEnvelope = isMessageEnvelope;
exports.isFileSnapshotPayload = isFileSnapshotPayload;
exports.isFilePatchPayload = isFilePatchPayload;
exports.isInjectPromptPayload = isInjectPromptPayload;
exports.isSnapshotRequestPayload = isSnapshotRequestPayload;
exports.buildEnvelope = buildEnvelope;
exports.parseEnvelope = parseEnvelope;
exports.PROTOCOL_VERSION = 1;
/** All capabilities supported by the current protocol version */
exports.ALL_CAPABILITIES = [
    'diff:snapshot',
    'diff:patch',
    'diff:focus',
    'prompt:inject',
    'session:revoke',
];
// ── Type guards ───────────────────────────────────────────────────────────────
function isMessageEnvelope(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const v = value;
    return (v['v'] === exports.PROTOCOL_VERSION &&
        typeof v['id'] === 'string' &&
        typeof v['ts'] === 'number' &&
        typeof v['type'] === 'string' &&
        'payload' in v);
}
function isFileSnapshotPayload(p) {
    if (typeof p !== 'object' || p === null) {
        return false;
    }
    const o = p;
    return (typeof o['fileName'] === 'string' &&
        typeof o['content'] === 'string' &&
        (o['encoding'] === 'utf8' || o['encoding'] === 'gzip+base64') &&
        typeof o['seq'] === 'number' &&
        typeof o['isDirty'] === 'boolean');
}
function isFilePatchPayload(p) {
    if (typeof p !== 'object' || p === null) {
        return false;
    }
    const o = p;
    return (typeof o['fileName'] === 'string' &&
        typeof o['patches'] === 'string' &&
        typeof o['fromSeq'] === 'number' &&
        typeof o['toSeq'] === 'number');
}
function isInjectPromptPayload(p) {
    if (typeof p !== 'object' || p === null) {
        return false;
    }
    const o = p;
    return typeof o['prompt'] === 'string' && o['prompt'].length > 0;
}
function isSnapshotRequestPayload(p) {
    if (typeof p !== 'object' || p === null) {
        return false;
    }
    const o = p;
    return (typeof o['fileName'] === 'string' &&
        o['fileName'].length > 0 &&
        (o['reason'] === 'gap' || o['reason'] === 'corruption' || o['reason'] === 'reconnect'));
}
// ── Envelope builder ──────────────────────────────────────────────────────────
let _seq = 0;
function buildEnvelope(type, payload, opts) {
    return {
        v: exports.PROTOCOL_VERSION,
        id: generateId(),
        ts: Date.now(),
        seq: ++_seq,
        type,
        payload,
        ...(opts?.ack ? { ack: opts.ack } : {}),
    };
}
function parseEnvelope(raw) {
    try {
        const parsed = JSON.parse(raw);
        return isMessageEnvelope(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
function generateId() {
    const globalCrypto = globalThis.crypto;
    if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
        return globalCrypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
//# sourceMappingURL=index.js.map