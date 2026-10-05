export const TERMINAL_PROTOCOL_VERSION = 1 as const;

export const MAX_TERMINAL_INPUT_BYTES = 16 * 1024; // 16 KB
export const MAX_TERMINAL_OUTPUT_BYTES = 32 * 1024; // 32 KB

export type TerminalMessageType =
  | 'TERM_HANDSHAKE'
  | 'TERM_HANDSHAKE_RESP'
  | 'TERM_ATTACH'
  | 'TERM_ATTACH_RESP'
  | 'TERM_DETACH'
  | 'TERM_INPUT'
  | 'TERM_INPUT_ACK'
  | 'TERM_OUTPUT'
  | 'TERM_CREDIT'
  | 'TERM_RESIZE'
  | 'TERM_MODE_CHANGE'
  | 'TERM_LIST_SESSIONS'
  | 'TERM_SESSIONS_LIST'
  | 'TERM_NEW_SESSION'
  | 'TERM_CLOSE_SESSION'
  | 'TERM_REVOKE'
  | 'TERM_KILL'
  | 'TERM_GAP'
  | 'TERM_ERROR'
  | 'TERM_PAIR'
  | 'TERM_PAIR_RESP'
  | 'TERM_PAIR_STATUS'
  | 'TERM_PAIR_STATUS_RESP';

export interface TerminalEnvelope<T extends TerminalMessageType = TerminalMessageType> {
  v: typeof TERMINAL_PROTOCOL_VERSION;
  id: string;
  ts: number;
  seq: number;
  type: T;
  payload: TerminalPayloadFor<T>;
}

export interface TerminalInputPayload {
  sessionId: string;
  inputId: string;
  generation: number;
  data: string;
}

export interface TerminalInputAckPayload {
  sessionId: string;
  inputId: string;
  generation: number;
}

export interface TerminalOutputPayload {
  sessionId: string;
  seq: number;
  data: string;
  creditsRemaining?: number;
}

export interface TerminalCreditPayload {
  sessionId: string;
  bytes: number;
}

export interface TerminalResizePayload {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalModeChangePayload {
  sessionId: string;
  mode: 'observe' | 'control';
}

export interface TerminalAttachPayload {
  sessionId: string;
  requestedMode: 'observe' | 'control';
  lastOffset?: number;
  deviceId?: string;
  clientNonce?: string;
}

export interface TerminalAttachRespPayload {
  sessionId: string;
  mode: 'observe' | 'control';
  cols: number;
  rows: number;
  startOffset: number;
  hasGap: boolean;
  hostNonce?: string;
  epoch?: string;
}

export interface TerminalDetachPayload {
  sessionId: string;
}

export interface TerminalNewSessionPayload {
  title?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalCloseSessionPayload {
  sessionId: string;
}

export interface TerminalSessionInfo {
  id: string;
  title: string;
  controllerDeviceId: string | null;
  observerCount: number;
  active: boolean;
}

export interface TerminalSessionsListPayload {
  sessions: TerminalSessionInfo[];
}

export interface TerminalGapPayload {
  sessionId: string;
  requestedOffset: number;
  retainedOffset: number;
}

export interface TerminalErrorPayload {
  code: string;
  message: string;
  sessionId?: string;
  /** Legacy field retained for backward compatibility with older relays/clients */
  error?: string;
}

export interface TerminalRevokePayload {
  deviceId?: string;
  reason?: string;
}

export interface TerminalKillPayload {
  sessionId?: string;
  all?: boolean;
}

export interface TerminalHandshakePayload {
  deviceId: string;
  deviceName: string;
  clientVersion: string;
}

export interface TerminalHandshakeRespPayload {
  accepted: boolean;
  reason?: string;
}

export interface EncryptedPacket {
  seq: number;
  nonce: string;
  ciphertext: string;
  epoch?: string;
}

export interface TerminalPairPayload {
  attemptId: string;
  code: string;
  clientPublicKey: string;
  clientDeviceName: string;
}

export interface TerminalPairRespPayload {
  success: boolean;
  attemptId?: string;
  sessionToken?: string;
  sas?: string;
  hostPublicKey?: string;
  error?: string;
}

export interface TerminalPairStatusPayload {
  attemptId: string;
  sessionToken: string;
}

export interface TerminalPairStatusRespPayload {
  approved: boolean;
  attemptId?: string;
  sessionToken?: string;
  deviceId?: string;
  hostPublicKey?: string;
  approvalProof?: string;
  error?: string;
}

export type TerminalPayloadFor<T extends TerminalMessageType> = T extends 'TERM_INPUT'
  ? TerminalInputPayload
  : T extends 'TERM_INPUT_ACK'
    ? TerminalInputAckPayload
    : T extends 'TERM_OUTPUT'
      ? TerminalOutputPayload
      : T extends 'TERM_CREDIT'
        ? TerminalCreditPayload
        : T extends 'TERM_RESIZE'
          ? TerminalResizePayload
          : T extends 'TERM_MODE_CHANGE'
            ? TerminalModeChangePayload
            : T extends 'TERM_ATTACH'
              ? TerminalAttachPayload
              : T extends 'TERM_ATTACH_RESP'
                ? TerminalAttachRespPayload
                : T extends 'TERM_DETACH'
                  ? TerminalDetachPayload
                  : T extends 'TERM_LIST_SESSIONS'
                    ? Record<string, never>
                    : T extends 'TERM_SESSIONS_LIST'
                      ? TerminalSessionsListPayload
                      : T extends 'TERM_NEW_SESSION'
                        ? TerminalNewSessionPayload
                        : T extends 'TERM_CLOSE_SESSION'
                          ? TerminalCloseSessionPayload
                          : T extends 'TERM_REVOKE'
                            ? TerminalRevokePayload
                            : T extends 'TERM_KILL'
                              ? TerminalKillPayload
                              : T extends 'TERM_GAP'
                                ? TerminalGapPayload
                                : T extends 'TERM_ERROR'
                                  ? TerminalErrorPayload
                                  : T extends 'TERM_HANDSHAKE'
                                    ? TerminalHandshakePayload
                                    : T extends 'TERM_HANDSHAKE_RESP'
                                      ? TerminalHandshakeRespPayload
                                      : T extends 'TERM_PAIR'
                                        ? TerminalPairPayload
                                        : T extends 'TERM_PAIR_RESP'
                                          ? TerminalPairRespPayload
                                          : T extends 'TERM_PAIR_STATUS'
                                            ? TerminalPairStatusPayload
                                            : T extends 'TERM_PAIR_STATUS_RESP'
                                              ? TerminalPairStatusRespPayload
                                              : Record<string, unknown>;

const VALID_MESSAGE_TYPES: Set<string> = new Set<TerminalMessageType>([
  'TERM_HANDSHAKE',
  'TERM_HANDSHAKE_RESP',
  'TERM_ATTACH',
  'TERM_ATTACH_RESP',
  'TERM_DETACH',
  'TERM_INPUT',
  'TERM_INPUT_ACK',
  'TERM_OUTPUT',
  'TERM_CREDIT',
  'TERM_RESIZE',
  'TERM_MODE_CHANGE',
  'TERM_LIST_SESSIONS',
  'TERM_SESSIONS_LIST',
  'TERM_NEW_SESSION',
  'TERM_CLOSE_SESSION',
  'TERM_REVOKE',
  'TERM_KILL',
  'TERM_GAP',
  'TERM_ERROR',
  'TERM_PAIR',
  'TERM_PAIR_RESP',
  'TERM_PAIR_STATUS',
  'TERM_PAIR_STATUS_RESP',
]);

export function isTerminalEnvelope(value: unknown): value is TerminalEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    v['v'] === TERMINAL_PROTOCOL_VERSION &&
    typeof v['id'] === 'string' &&
    typeof v['ts'] === 'number' &&
    typeof v['type'] === 'string' &&
    VALID_MESSAGE_TYPES.has(v['type']) &&
    typeof v['payload'] === 'object' &&
    v['payload'] !== null
  );
}

export function isTerminalInputPayload(p: unknown): p is TerminalInputPayload {
  if (typeof p !== 'object' || p === null) {
    return false;
  }
  const o = p as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || o['sessionId'].length === 0) {
    return false;
  }
  if (typeof o['inputId'] !== 'string' || o['inputId'].length === 0) {
    return false;
  }
  if (
    typeof o['generation'] !== 'number' ||
    o['generation'] < 0 ||
    !Number.isInteger(o['generation'])
  ) {
    return false;
  }
  if (
    typeof o['data'] !== 'string' ||
    Buffer.byteLength(o['data'], 'utf8') > MAX_TERMINAL_INPUT_BYTES
  ) {
    return false;
  }
  return true;
}

export function isTerminalResizePayload(p: unknown): p is TerminalResizePayload {
  if (typeof p !== 'object' || p === null) {
    return false;
  }
  const o = p as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || o['sessionId'].length === 0) {
    return false;
  }
  if (typeof o['cols'] !== 'number' || o['cols'] <= 0 || !Number.isInteger(o['cols'])) {
    return false;
  }
  if (typeof o['rows'] !== 'number' || o['rows'] <= 0 || !Number.isInteger(o['rows'])) {
    return false;
  }
  return true;
}

export function isTerminalCreditPayload(p: unknown): p is TerminalCreditPayload {
  if (typeof p !== 'object' || p === null) {
    return false;
  }
  const o = p as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || o['sessionId'].length === 0) {
    return false;
  }
  if (typeof o['bytes'] !== 'number' || o['bytes'] <= 0 || !Number.isInteger(o['bytes'])) {
    return false;
  }
  return true;
}

export function isTerminalModeChangePayload(p: unknown): p is TerminalModeChangePayload {
  if (typeof p !== 'object' || p === null) {
    return false;
  }
  const o = p as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || o['sessionId'].length === 0) {
    return false;
  }
  if (o['mode'] !== 'observe' && o['mode'] !== 'control') {
    return false;
  }
  return true;
}

let _termSeq = 0;

export function buildTerminalEnvelope<T extends TerminalMessageType>(
  type: T,
  payload: TerminalPayloadFor<T>
): TerminalEnvelope<T> {
  return {
    v: TERMINAL_PROTOCOL_VERSION,
    id: generateUUID(),
    ts: Date.now(),
    seq: ++_termSeq,
    type,
    payload,
  };
}

export function parseTerminalEnvelope(raw: string): TerminalEnvelope | null {
  try {
    const parsed = JSON.parse(raw);
    return isTerminalEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function generateUUID(): string {
  const globalCrypto = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
