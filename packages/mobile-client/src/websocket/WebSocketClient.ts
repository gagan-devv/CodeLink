import { io, Socket } from 'socket.io-client';
import { FileContextPayload, SyncFullContextMessage } from '@codelink/protocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface WebSocketClientConfig {
  url: string;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketClientConfig;
  private onPayloadCallback: ((payload: FileContextPayload) => void) | null = null;
  private onStatusChangeCallback: ((status: ConnectionStatus) => void) | null = null;
  private currentStatus: ConnectionStatus = 'disconnected';

  constructor(config: WebSocketClientConfig) {
    this.config = {
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      ...config,
    };
  }

  /**
   * Connect to the relay server
   */
  connect(): void {
    if (this.socket) {
      return;
    }

    this.updateStatus('connecting');

    this.socket = io(this.config.url, {
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      reconnectionAttempts: this.config.reconnectionAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocketClient] Connected to relay server');
      this.updateStatus('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocketClient] Disconnected from relay server');
      this.updateStatus('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocketClient] Connection error:', error);
      this.updateStatus('disconnected');
    });

    this.socket.on('message', (data: string) => {
      this.handleMessage(data);
    });
  }

  /**
   * Disconnect from the relay server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.updateStatus('disconnected');
    }
  }

  /**
   * Register callback for when FileContextPayload is received
   */
  onPayload(callback: (payload: FileContextPayload) => void): void {
    this.onPayloadCallback = callback;
  }

  /**
   * Register callback for connection status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.currentStatus === 'connected';
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log('[WebSocketClient] Received message:', message);

      if (message.type === 'SYNC_FULL_CONTEXT') {
        this.handleSyncFullContext(message as SyncFullContextMessage);
      }
    } catch (error) {
      console.error('[WebSocketClient] Error parsing message:', error);
      console.error('[WebSocketClient] Raw data:', data);
      // Continue operation despite parse error (Requirement 6.4)
    }
  }

  /**
   * Handle SYNC_FULL_CONTEXT messages
   */
  private handleSyncFullContext(message: SyncFullContextMessage): void {
    try {
      const payload = message.payload;

      // Validate payload structure
      if (!this.isValidPayload(payload)) {
        console.error('[WebSocketClient] Invalid payload structure:', payload);
        return;
      }

      console.log('[WebSocketClient] Parsed FileContextPayload:', payload);

      // Invoke callback if registered
      if (this.onPayloadCallback) {
        this.onPayloadCallback(payload);
      }
    } catch (error) {
      console.error('[WebSocketClient] Error handling SYNC_FULL_CONTEXT:', error);
      // Continue operation despite error (Requirement 6.4)
    }
  }

  /**
   * Validate FileContextPayload structure
   */
  private isValidPayload(payload: any): payload is FileContextPayload {
    return (
      payload &&
      typeof payload === 'object' &&
      typeof payload.fileName === 'string' &&
      typeof payload.originalFile === 'string' &&
      typeof payload.modifiedFile === 'string' &&
      typeof payload.isDirty === 'boolean' &&
      typeof payload.timestamp === 'number'
    );
  }

  /**
   * Update connection status and notify callback
   */
  private updateStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }
}
