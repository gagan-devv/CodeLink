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
  fileName: string;           // Workspace-relative file path (e.g., "src/index.ts")
  originalFile: string;       // Content from Git HEAD (empty string if untracked)
  modifiedFile: string;       // Current file content from disk
  isDirty: boolean;          // True if file has unsaved changes in editor
  timestamp: number;         // Unix timestamp in milliseconds when diff was generated
}

// Sync full context message for sending diffs to mobile
export interface SyncFullContextMessage extends Message {
  type: 'SYNC_FULL_CONTEXT';
  payload: FileContextPayload;
}

// Inject prompt message from mobile to extension
export interface InjectPromptMessage extends Message {
  type: 'INJECT_PROMPT';
  prompt: string;
}

// Inject prompt response from extension to mobile
export interface InjectPromptResponseMessage extends Message {
  type: 'INJECT_PROMPT_RESPONSE';
  success: boolean;
  error?: string;
  editorUsed?: string;
  commandUsed?: string;
  originalRequestId?: string; // ID of the original INJECT_PROMPT message
}

// Union type for all messages
export type ProtocolMessage = PingMessage | PongMessage | SyncFullContextMessage | InjectPromptMessage | InjectPromptResponseMessage;
