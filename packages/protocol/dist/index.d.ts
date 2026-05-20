export declare const PROTOCOL_VERSION: 1;
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
    v: typeof PROTOCOL_VERSION;
    id: string;
    ts: number;
    type: T;
    seq?: number;
    ack?: string;
    payload: PayloadFor<T>;
}
export type MessageType = 'HANDSHAKE' | 'HANDSHAKE_ACK' | 'PING' | 'PONG' | 'SESSION_REVOKED' | 'FILE_SNAPSHOT' | 'FILE_PATCH' | 'EDITOR_FOCUS' | 'PATCH_ACK' | 'SNAPSHOT_REQUEST' | 'INJECT_PROMPT' | 'PROMPT_RESPONSE';
/**
 * Maps each MessageType to its payload interface.
 * Used to make MessageEnvelope<T> strongly typed end-to-end.
 */
export type PayloadFor<T extends MessageType> = T extends 'HANDSHAKE' ? HandshakePayload : T extends 'HANDSHAKE_ACK' ? HandshakeAckPayload : T extends 'PING' ? PingPayload : T extends 'PONG' ? PongPayload : T extends 'SESSION_REVOKED' ? SessionRevokedPayload : T extends 'FILE_SNAPSHOT' ? FileSnapshotPayload : T extends 'FILE_PATCH' ? FilePatchPayload : T extends 'EDITOR_FOCUS' ? EditorFocusPayload : T extends 'PATCH_ACK' ? PatchAckPayload : T extends 'SNAPSHOT_REQUEST' ? SnapshotRequestPayload : T extends 'INJECT_PROMPT' ? InjectPromptPayload : T extends 'PROMPT_RESPONSE' ? PromptResponsePayload : never;
export interface HandshakePayload {
    role: 'host' | 'client';
    capabilities: Capability[];
    clientVersion: string;
}
export interface HandshakeAckPayload {
    connectionId: string;
    serverCapabilities: Capability[];
    negotiatedCapabilities: Capability[];
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
export interface FileSnapshotPayload {
    fileName: string;
    content: string;
    encoding: 'utf8' | 'gzip+base64';
    seq: number;
    isDirty: boolean;
    gitHead: boolean;
    timestamp: number;
}
export interface FilePatchPayload {
    fileName: string;
    patches: string;
    fromSeq: number;
    toSeq: number;
    isDirty: boolean;
    timestamp: number;
}
export interface EditorFocusPayload {
    fileName: string | null;
    cursorLine: number;
    cursorCol: number;
}
export interface PatchAckPayload {
    fileName: string;
    seq: number;
}
export interface SnapshotRequestPayload {
    fileName: string;
    reason: 'gap' | 'corruption' | 'reconnect';
}
export interface InjectPromptPayload {
    prompt: string;
    targetFile?: string;
}
export interface PromptResponsePayload {
    originalId: string;
    success: boolean;
    editorUsed?: string;
    error?: string;
}
export type Capability = 'diff:snapshot' | 'diff:patch' | 'diff:focus' | 'prompt:inject' | 'session:revoke';
/** All capabilities supported by the current protocol version */
export declare const ALL_CAPABILITIES: Capability[];
export declare function isMessageEnvelope(value: unknown): value is MessageEnvelope;
export declare function isFileSnapshotPayload(p: unknown): p is FileSnapshotPayload;
export declare function isFilePatchPayload(p: unknown): p is FilePatchPayload;
export declare function isInjectPromptPayload(p: unknown): p is InjectPromptPayload;
export declare function isSnapshotRequestPayload(p: unknown): p is SnapshotRequestPayload;
export declare function buildEnvelope<T extends MessageType>(type: T, payload: PayloadFor<T>, opts?: {
    ack?: string;
}): MessageEnvelope<T>;
export declare function parseEnvelope(raw: string): MessageEnvelope | null;
//# sourceMappingURL=index.d.ts.map