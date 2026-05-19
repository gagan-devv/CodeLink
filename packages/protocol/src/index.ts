export const PROTOCOL_VERSION = 1 as const;

// ── Envelope ─────────────────────────────────────────────────────────────────

/**
 * Every message in both directions uses this wrapper.
 *
 * - `v`   — always 1; lets future clients detect incompatible protocol versions
 * - `id`  — UUID v4; used to correlate responses (e.g. PROMPT_RESPONSE.originalId)
 * - `ts`  — unix milliseconds at send time; for latency measurement
 * - `seq` — sender's outbound counter; receiver detects gaps and requests re-sync
 * - `ack` — echoes the `id` of the message being acknowledged
 */
export interface MessageEnvelope<T extends MessageType = MessageType> {
  v:        typeof PROTOCOL_VERSION;
  id:       string;
  ts:       number;
  type:     T;
  seq?:     number;
  ack?:     string;
  payload:  PayloadFor<T>;
}

// ── Message types ─────────────────────────────────────────────────────────────

export type MessageType =
  // Session / control
  | 'HANDSHAKE'           // C→H  optional capability negotiation after connect
  | 'HANDSHAKE_ACK'       // R→*  relay confirms connection, echoes capabilities
  | 'PING'                // *→*  application-level liveness check
  | 'PONG'                // *→*  response to PING
  | 'SESSION_REVOKED'     // R→*  host revoked the session; both sides should close

  // Diff sync
  | 'FILE_SNAPSHOT'       // H→C  full file content; establishes the patch baseline
  | 'FILE_PATCH'          // H→C  incremental diff-match-patch patch
  | 'EDITOR_FOCUS'        // H→C  active file + cursor position changed

  // Acknowledgements
  | 'PATCH_ACK'           // C→H  mobile applied a patch successfully
  | 'SNAPSHOT_REQUEST'    // C→H  mobile detected a gap; requests a fresh snapshot

  // AI prompt injection
  | 'INJECT_PROMPT'       // C→H  mobile sends a prompt to the active AI editor
  | 'PROMPT_RESPONSE';    // H→C  result of the prompt injection

// ── Payload map ───────────────────────────────────────────────────────────────

/**
 * Maps each MessageType to its payload interface.
 * Used to make MessageEnvelope<T> strongly typed end-to-end.
 */
export type PayloadFor<T extends MessageType> =
  T extends 'HANDSHAKE'        ? HandshakePayload        :
  T extends 'HANDSHAKE_ACK'    ? HandshakeAckPayload     :
  T extends 'PING'             ? PingPayload             :
  T extends 'PONG'             ? PongPayload             :
  T extends 'SESSION_REVOKED'  ? SessionRevokedPayload   :
  T extends 'FILE_SNAPSHOT'    ? FileSnapshotPayload     :
  T extends 'FILE_PATCH'       ? FilePatchPayload        :
  T extends 'EDITOR_FOCUS'     ? EditorFocusPayload      :
  T extends 'PATCH_ACK'        ? PatchAckPayload         :
  T extends 'SNAPSHOT_REQUEST' ? SnapshotRequestPayload  :
  T extends 'INJECT_PROMPT'    ? InjectPromptPayload     :
  T extends 'PROMPT_RESPONSE'  ? PromptResponsePayload   :
  never;

// ── Payload interfaces ────────────────────────────────────────────────────────

export interface HandshakePayload {
  role:          'host' | 'client';
  capabilities:  Capability[];
  clientVersion: string;
}

export interface HandshakeAckPayload {
  connectionId:             string;
  serverCapabilities:       Capability[];
  negotiatedCapabilities:   Capability[];
}

export interface PingPayload {
  source: 'host' | 'client';
}

export interface PongPayload {
  originalId: string;
}

export interface SessionRevokedPayload {
  reason: 'host_requested' | 'token_expired' | 'server_shutdown';
}

// ── Diff sync payloads ───────────────────────────────────────────────────────

export interface FileSnapshotPayload {
  fileName:  string;
  content:   string;
  encoding:  'utf8' | 'gzip+base64';

  seq:       number;

  isDirty:   boolean;

  gitHead:   boolean;

  timestamp: number;
}

export interface FilePatchPayload {
  fileName: string;

  patches:  string;

  fromSeq:  number;

  toSeq:    number;

  isDirty:  boolean;
  timestamp: number;
}

export interface EditorFocusPayload {
  fileName:   string | null;
  cursorLine: number;
  cursorCol:  number;
}

// ── Acknowledgement payloads ──────────────────────────────────────────────────

export interface PatchAckPayload {
  fileName: string;
  seq:      number;
}

export interface SnapshotRequestPayload {
  fileName: string;
  reason:   'gap' | 'corruption' | 'reconnect';
}

// ── Prompt payloads ───────────────────────────────────────────────────────────

export interface InjectPromptPayload {
  prompt:       string;
  targetFile?:  string;
}

export interface PromptResponsePayload {
  originalId:  string;
  success:     boolean;
  editorUsed?: string;
  error?:      string;
}

// ── Capabilities ──────────────────────────────────────────────────────────────

export type Capability =
  | 'diff:snapshot'     // can send/receive FILE_SNAPSHOT
  | 'diff:patch'        // can send/receive FILE_PATCH
  | 'diff:focus'        // can send/receive EDITOR_FOCUS
  | 'prompt:inject'     // can send INJECT_PROMPT / receive PROMPT_RESPONSE
  | 'session:revoke';   // understands SESSION_REVOKED

/** All capabilities supported by the current protocol version */
export const ALL_CAPABILITIES: Capability[] = [
  'diff:snapshot',
  'diff:patch',
  'diff:focus',
  'prompt:inject',
  'session:revoke',
];

// ── Type guards ───────────────────────────────────────────────────────────────

export function isMessageEnvelope(value: unknown): value is MessageEnvelope {
  if (typeof value !== 'object' || value === null) { return false; }
  const v = value as Record<string, unknown>;
  return (
    v['v']    === PROTOCOL_VERSION &&
    typeof v['id']   === 'string' &&
    typeof v['ts']   === 'number' &&
    typeof v['type'] === 'string' &&
    'payload' in v
  );
}

export function isFileSnapshotPayload(p: unknown): p is FileSnapshotPayload {
  if (typeof p !== 'object' || p === null) { return false; }
  const o = p as Record<string, unknown>;
  return (
    typeof o['fileName'] === 'string' &&
    typeof o['content']  === 'string' &&
    (o['encoding'] === 'utf8' || o['encoding'] === 'gzip+base64') &&
    typeof o['seq']      === 'number' &&
    typeof o['isDirty']  === 'boolean'
  );
}

export function isFilePatchPayload(p: unknown): p is FilePatchPayload {
  if (typeof p !== 'object' || p === null) { return false; }
  const o = p as Record<string, unknown>;
  return (
    typeof o['fileName'] === 'string' &&
    typeof o['patches']  === 'string' &&
    typeof o['fromSeq']  === 'number' &&
    typeof o['toSeq']    === 'number'
  );
}

export function isInjectPromptPayload(p: unknown): p is InjectPromptPayload {
  if (typeof p !== 'object' || p === null) { return false; }
  const o = p as Record<string, unknown>;
  return typeof o['prompt'] === 'string' && o['prompt'].length > 0;
}

export function isSnapshotRequestPayload(p: unknown): p is SnapshotRequestPayload {
  if (typeof p !== 'object' || p === null) { return false; }
  const o = p as Record<string, unknown>;
  return (
    typeof o['fileName'] === 'string' &&
    o['fileName'].length > 0 &&
    (o['reason'] === 'gap' || o['reason'] === 'corruption' || o['reason'] === 'reconnect')
  );
}

// ── Envelope builder ──────────────────────────────────────────────────────────

let _seq = 0;

export function buildEnvelope<T extends MessageType>(
  type:    T,
  payload: PayloadFor<T>,
  opts?: { ack?: string },
): MessageEnvelope<T> {
  return {
    v:       PROTOCOL_VERSION,
    id:      generateId(),
    ts:      Date.now(),
    seq:     ++_seq,
    type,
    payload,
    ...(opts?.ack ? { ack: opts.ack } : {}),
  };
}

export function parseEnvelope(raw: string): MessageEnvelope | null {
  try {
    const parsed = JSON.parse(raw);
    return isMessageEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function generateId(): string {
  const globalCrypto = (globalThis as any).crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}