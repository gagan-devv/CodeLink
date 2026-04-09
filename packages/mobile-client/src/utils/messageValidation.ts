import type {
  InjectPromptMessage,
  InjectPromptResponse,
  SyncFullContextMessage,
  ProtocolMessage,
} from '@codelink/protocol';

/**
 * Type guard to check if a message is an InjectPromptMessage
 */
export function isInjectPromptMessage(message: unknown): message is InjectPromptMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check all required fields explicitly
  if (msg.type !== 'INJECT_PROMPT') return false;
  if (typeof msg.id !== 'string') return false;
  if (typeof msg.timestamp !== 'number') return false;
  if (!msg.payload || typeof msg.payload !== 'object') return false;
  const payload = msg.payload as Record<string, unknown>;
  if (typeof payload.prompt !== 'string') return false;

  return true;
}

/**
 * Type guard to check if a message is an InjectPromptResponse
 */
export function isInjectPromptResponse(message: unknown): message is InjectPromptResponse {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check all required fields explicitly
  if (msg.type !== 'INJECT_PROMPT_RESPONSE') return false;
  if (typeof msg.id !== 'string') return false;
  if (typeof msg.timestamp !== 'number') return false;
  if (typeof msg.originalId !== 'string') return false;
  if (!msg.payload || typeof msg.payload !== 'object') return false;
  const payload = msg.payload as Record<string, unknown>;
  if (typeof payload.success !== 'boolean') return false;

  // Check optional fields if present
  if (payload.error !== undefined && typeof payload.error !== 'string') {
    return false;
  }
  if (payload.editorUsed !== undefined && typeof payload.editorUsed !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a message is a SyncFullContextMessage
 */
export function isSyncFullContextMessage(message: unknown): message is SyncFullContextMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check all required fields explicitly
  if (msg.type !== 'SYNC_FULL_CONTEXT') return false;
  if (typeof msg.id !== 'string') return false;
  if (typeof msg.timestamp !== 'number') return false;
  if (!msg.payload || typeof msg.payload !== 'object') return false;
  const payload = msg.payload as Record<string, unknown>;
  if (typeof payload.fileName !== 'string') return false;
  if (typeof payload.originalFile !== 'string') return false;
  if (typeof payload.modifiedFile !== 'string') return false;
  if (typeof payload.isDirty !== 'boolean') return false;
  if (typeof payload.timestamp !== 'number') return false;

  return true;
}

/**
 * Validates that a message conforms to the ProtocolMessage interface
 */
export function validateProtocolMessage(message: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (!message || typeof message !== 'object') {
    return { isValid: false, error: 'Message must be an object' };
  }

  const msg = message as Record<string, unknown>;

  // Check base Message fields
  if (typeof msg.id !== 'string') {
    return { isValid: false, error: 'Message must have a string id' };
  }

  if (typeof msg.timestamp !== 'number') {
    return { isValid: false, error: 'Message must have a number timestamp' };
  }

  if (typeof msg.type !== 'string') {
    return { isValid: false, error: 'Message must have a string type' };
  }

  // Check specific message types
  if (
    isInjectPromptMessage(message) ||
    isInjectPromptResponse(message) ||
    isSyncFullContextMessage(message)
  ) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `Unknown or invalid message type: ${msg.type}`,
  };
}

/**
 * Discriminates message type and returns the specific message type
 */
export function discriminateMessageType(
  message: ProtocolMessage
):
  | { type: 'INJECT_PROMPT'; message: InjectPromptMessage }
  | { type: 'INJECT_PROMPT_RESPONSE'; message: InjectPromptResponse }
  | { type: 'SYNC_FULL_CONTEXT'; message: SyncFullContextMessage }
  | { type: 'UNKNOWN'; message: ProtocolMessage } {
  if (isInjectPromptMessage(message)) {
    return { type: 'INJECT_PROMPT', message };
  }

  if (isInjectPromptResponse(message)) {
    return { type: 'INJECT_PROMPT_RESPONSE', message };
  }

  if (isSyncFullContextMessage(message)) {
    return { type: 'SYNC_FULL_CONTEXT', message };
  }

  return { type: 'UNKNOWN', message };
}
