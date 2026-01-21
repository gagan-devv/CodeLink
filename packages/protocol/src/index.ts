// Base message structure
export interface Message {
  id: string;
  timestamp: number;
  type: string;
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

// Union type for all messages
export type ProtocolMessage = PingMessage | PongMessage;
