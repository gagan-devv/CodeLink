// Base message structure
export interface Message {
  id: string;
  timestamp: number;
  type: string;
}

// Message type enum
export enum MessageType {
  PING = 'PING',
  PONG = 'PONG',
  SYNC_FULL_CONTEXT = 'SYNC_FULL_CONTEXT',
  INJECT_PROMPT = 'INJECT_PROMPT',
  INJECT_PROMPT_RESPONSE = 'INJECT_PROMPT_RESPONSE',
}

// Example: Ping message from extension to relay
export interface PingMessage extends Message {
  type: 'ping';
  source: 'extension' | 'mobile';
}

// Example: Pong response from relay
export interface PongMessage extends Message {
  type: 'pong';
  originalId: string;
}

// File context payload for diff viewing
export interface FileContextPayload {
  fileName: string; // Workspace-relative file path (e.g., "src/index.ts")
  originalFile: string; // Content from Git HEAD (empty string if untracked)
  modifiedFile: string; // Current file content from disk
  isDirty: boolean; // True if file has unsaved changes in editor
  timestamp: number; // Unix timestamp in milliseconds when diff was generated
}

// Sync full context message for sending diffs to mobile
export interface SyncFullContextMessage extends Message {
  type: 'SYNC_FULL_CONTEXT';
  payload: FileContextPayload;
}

// Inject prompt message from mobile to relay
export interface InjectPromptMessage extends Message {
  type: 'INJECT_PROMPT';
  payload: {
    prompt: string;
  };
}

// Inject prompt response from relay to mobile
export interface InjectPromptResponse extends Message {
  type: 'INJECT_PROMPT_RESPONSE';
  payload: {
    success: boolean;
    error?: string;
    editorUsed?: string;
  };
  originalId: string;
}

// Union type for all messages
export type ProtocolMessage =
  | PingMessage
  | PongMessage
  | SyncFullContextMessage
  | InjectPromptMessage
  | InjectPromptResponse;

// Type guard functions for runtime type checking

/**
 * Type guard to check if a value is a valid Message
 */
export function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Message).id === 'string' &&
    'timestamp' in value &&
    typeof (value as Message).timestamp === 'number' &&
    'type' in value &&
    typeof (value as Message).type === 'string'
  );
}

/**
 * Type guard to check if a value is a PingMessage
 */
export function isPingMessage(value: unknown): value is PingMessage {
  return (
    isMessage(value) &&
    (value as PingMessage).type === 'ping' &&
    'source' in value &&
    ((value as PingMessage).source === 'extension' || (value as PingMessage).source === 'mobile')
  );
}

/**
 * Type guard to check if a value is a PongMessage
 */
export function isPongMessage(value: unknown): value is PongMessage {
  return (
    isMessage(value) &&
    (value as PongMessage).type === 'pong' &&
    'originalId' in value &&
    typeof (value as PongMessage).originalId === 'string'
  );
}

/**
 * Type guard to check if a value is a valid FileContextPayload
 */
export function isFileContextPayload(value: unknown): value is FileContextPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fileName' in value &&
    typeof (value as FileContextPayload).fileName === 'string' &&
    'originalFile' in value &&
    typeof (value as FileContextPayload).originalFile === 'string' &&
    'modifiedFile' in value &&
    typeof (value as FileContextPayload).modifiedFile === 'string' &&
    'isDirty' in value &&
    typeof (value as FileContextPayload).isDirty === 'boolean' &&
    'timestamp' in value &&
    typeof (value as FileContextPayload).timestamp === 'number'
  );
}

/**
 * Type guard to check if a value is a SyncFullContextMessage
 */
export function isSyncFullContextMessage(value: unknown): value is SyncFullContextMessage {
  return (
    isMessage(value) &&
    (value as SyncFullContextMessage).type === 'SYNC_FULL_CONTEXT' &&
    'payload' in value &&
    isFileContextPayload((value as SyncFullContextMessage).payload)
  );
}

/**
 * Type guard to check if a value is an InjectPromptMessage
 */
export function isInjectPromptMessage(value: unknown): value is InjectPromptMessage {
  return (
    isMessage(value) &&
    (value as InjectPromptMessage).type === 'INJECT_PROMPT' &&
    'payload' in value &&
    typeof (value as InjectPromptMessage).payload === 'object' &&
    (value as InjectPromptMessage).payload !== null &&
    'prompt' in (value as InjectPromptMessage).payload &&
    typeof (value as InjectPromptMessage).payload.prompt === 'string'
  );
}

/**
 * Type guard to check if a value is an InjectPromptResponse
 */
export function isInjectPromptResponse(value: unknown): value is InjectPromptResponse {
  if (!isMessage(value) || (value as InjectPromptResponse).type !== 'INJECT_PROMPT_RESPONSE') {
    return false;
  }

  const msg = value as InjectPromptResponse;

  if (!('originalId' in msg) || typeof msg.originalId !== 'string') {
    return false;
  }

  if (!('payload' in msg) || typeof msg.payload !== 'object' || msg.payload === null) {
    return false;
  }

  if (!('success' in msg.payload) || typeof msg.payload.success !== 'boolean') {
    return false;
  }

  // Optional fields validation
  if ('error' in msg.payload && typeof msg.payload.error !== 'string') {
    return false;
  }

  if ('editorUsed' in msg.payload && typeof msg.payload.editorUsed !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a value is any valid ProtocolMessage
 */
export function isProtocolMessage(value: unknown): value is ProtocolMessage {
  return (
    isPingMessage(value) ||
    isPongMessage(value) ||
    isSyncFullContextMessage(value) ||
    isInjectPromptMessage(value) ||
    isInjectPromptResponse(value)
  );
}
