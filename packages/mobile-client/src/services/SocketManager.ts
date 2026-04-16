import { io, Socket } from 'socket.io-client';
import type { ProtocolMessage } from '@codelink/protocol';
import { getConfig } from '../config';

/**
 * SocketManager interface defines the contract for WebSocket connection management
 */
export interface SocketManager {
  // Connection management
  connect(serverUrl: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Message sending
  sendMessage(message: ProtocolMessage): void;

  // Event listeners
  onMessage(handler: (message: ProtocolMessage) => void): void;
  onConnect(handler: () => void): void;
  onDisconnect(handler: () => void): void;
  onError(handler: (error: Error) => void): void;
}

/**
 * SocketManagerImpl implements WebSocket connection management using Socket.IO
 * with automatic reconnection and exponential backoff
 */
export class SocketManagerImpl implements SocketManager {
  private socket: Socket | null = null;
  private messageHandlers: Array<(message: ProtocolMessage) => void> = [];
  private connectHandlers: Array<() => void> = [];
  private disconnectHandlers: Array<() => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private baseReconnectDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;

  constructor() {
    // Load configuration values
    const config = getConfig();
    this.maxReconnectAttempts = config.socketOptions.reconnectionAttempts;
    this.baseReconnectDelay = config.socketOptions.reconnectionDelay;
  }

  /**
   * Establishes connection to the relay server
   * @param serverUrl - WebSocket server URL
   */
  async connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isManualDisconnect = false;

        // Get configuration
        const config = getConfig();

        // Initialize Socket.IO connection with configuration
        this.socket = io(serverUrl, {
          reconnection: false, // We handle reconnection manually for exponential backoff
          timeout: config.socketOptions.timeout,
          transports: ['websocket'],
        });

        // Set up event listeners
        this.socket.on('connect', () => {
          this.reconnectAttempts = 0;
          this.notifyConnectHandlers();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          this.notifyDisconnectHandlers();

          // Attempt automatic reconnection if not manually disconnected
          if (!this.isManualDisconnect && reason !== 'io client disconnect') {
            this.attemptReconnect(serverUrl);
          }
        });

        this.socket.on('message', (data: unknown) => {
          console.log('[SocketManager] Received message event, data type:', typeof data);
          console.log('[SocketManager] Raw data:', data);
          console.log(
            '[SocketManager] Number of registered handlers:',
            this.messageHandlers.length
          );
          try {
            // Parse JSON string from relay server
            const message = JSON.parse(data as string) as ProtocolMessage;
            console.log('[SocketManager] Parsed message:', message);
            this.notifyMessageHandlers(message);
          } catch (error) {
            console.error('[SocketManager] Error parsing message:', error);
            const err = error instanceof Error ? error : new Error('Message parsing failed');
            this.notifyErrorHandlers(err);
          }
        });

        this.socket.on('connect_error', (error) => {
          const err = new Error(`Connection error: ${error.message}`);
          this.notifyErrorHandlers(err);

          // If initial connection fails, reject the promise
          if (this.reconnectAttempts === 0) {
            reject(err);
          }

          // Attempt reconnection
          if (!this.isManualDisconnect) {
            this.attemptReconnect(serverUrl);
          }
        });

        this.socket.on('error', (error) => {
          const err = error instanceof Error ? error : new Error('Socket error');
          this.notifyErrorHandlers(err);
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to initialize socket');
        this.notifyErrorHandlers(err);
        reject(err);
      }
    });
  }

  /**
   * Attempts to reconnect with exponential backoff
   * @param serverUrl - WebSocket server URL
   */
  private attemptReconnect(serverUrl: string): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = new Error('Max reconnection attempts reached');
      this.notifyErrorHandlers(error);
      return;
    }

    // Calculate delay with exponential backoff
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    // Schedule reconnection attempt
    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualDisconnect) {
        this.connect(serverUrl).catch((_error) => {
          // Error already handled in connect method
        });
      }
    }, delay);
  }

  /**
   * Disconnects from the relay server
   */
  disconnect(): void {
    this.isManualDisconnect = true;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Checks if socket is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /**
   * Sends a message to the relay server
   * @param message - Protocol message to send
   * @throws Error if not connected
   */
  sendMessage(message: ProtocolMessage): void {
    if (!this.isConnected()) {
      const error = new Error('Cannot send message: not connected to server');
      this.notifyErrorHandlers(error);
      throw error;
    }

    try {
      this.socket!.emit('message', JSON.stringify(message));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to send message');
      this.notifyErrorHandlers(err);
      throw err;
    }
  }

  /**
   * Registers a handler for incoming messages
   * @param handler - Function to call when message is received
   */
  onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Registers a handler for connection events
   * @param handler - Function to call when connected
   */
  onConnect(handler: () => void): void {
    this.connectHandlers.push(handler);
  }

  /**
   * Registers a handler for disconnection events
   * @param handler - Function to call when disconnected
   */
  onDisconnect(handler: () => void): void {
    this.disconnectHandlers.push(handler);
  }

  /**
   * Registers a handler for error events
   * @param handler - Function to call when error occurs
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Notifies all registered message handlers
   */
  private notifyMessageHandlers(message: ProtocolMessage): void {
    console.log('[SocketManager] Notifying', this.messageHandlers.length, 'message handlers');
    this.messageHandlers.forEach((handler, index) => {
      try {
        console.log('[SocketManager] Calling handler', index);
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  /**
   * Notifies all registered connect handlers
   */
  private notifyConnectHandlers(): void {
    this.connectHandlers.forEach((handler) => {
      try {
        handler();
      } catch (error) {
        console.error('Error in connect handler:', error);
      }
    });
  }

  /**
   * Notifies all registered disconnect handlers
   */
  private notifyDisconnectHandlers(): void {
    this.disconnectHandlers.forEach((handler) => {
      try {
        handler();
      } catch (error) {
        console.error('Error in disconnect handler:', error);
      }
    });
  }

  /**
   * Notifies all registered error handlers
   */
  private notifyErrorHandlers(error: Error): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    });
  }
}
