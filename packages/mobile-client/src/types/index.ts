export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface ConnectionState {
  status: ConnectionStatus;
  error: Error | null;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
}
