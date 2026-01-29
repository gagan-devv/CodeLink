import { io, Socket } from 'socket.io-client';
import { ProtocolMessage, InjectPromptMessage } from '@codelink/protocol';

/**
 * Message handler callback type for incoming messages
 */
export type MessageHandler = (message: ProtocolMessage) => void | Promise<void>;

/**
 * WebSocketClient manages the connection to the relay server and handles
 * message transmission with queueing and retry logic.
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private messageQueue: ProtocolMessage[] = [];
  private readonly maxQueueSize = 100;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseRetryDelay = 1000; // 1 second
  private isConnecting = false;
  private messageHandlers: MessageHandler[] = [];

  /**
   * Initialize and connect to the relay server
   */
  public connect(url: string): void {
    if (this.socket || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    this.socket = io(url, {
      reconnection: true,
      reconnectionDelay: this.baseRetryDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  /**
   * Set up socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`WebSocket disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        return;
      }

      const delay = this.calculateBackoffDelay();
      console.log(`Connection error, retrying in ${delay}ms...`, error.message);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Handle incoming messages
    this.socket.on('message', (data: string) => {
      try {
        const message = JSON.parse(data) as ProtocolMessage;
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Error parsing incoming message:', error);
      }
    });
  }

  /**
   * Handle incoming messages by notifying all registered handlers
   */
  private handleIncomingMessage(message: ProtocolMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  /**
   * Register a message handler for incoming messages
   */
  public onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Remove a message handler
   */
  public offMessage(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(): number {
    return Math.min(
      this.baseRetryDelay * Math.pow(2, this.reconnectAttempts),
      5000
    );
  }

  /**
   * Send a message to the relay server
   */
  public send(message: ProtocolMessage): void {
    if (this.isConnected()) {
      this.socket!.emit('message', JSON.stringify(message));
    } else {
      this.queueMessage(message);
    }
  }

  /**
   * Queue a message for later transmission
   */
  private queueMessage(message: ProtocolMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      console.warn('Message queue full, dropping oldest message');
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  /**
   * Flush queued messages when connection is restored
   */
  private flushMessageQueue(): void {
    if (!this.isConnected()) {
      return;
    }

    const queueLength = this.messageQueue.length;
    if (queueLength === 0) {
      return;
    }

    console.log(`Flushing ${queueLength} queued messages`);

    // Rate limit: send 10 messages per second
    const messagesPerBatch = 10;
    const batchDelay = 1000;

    const sendBatch = () => {
      const batch = this.messageQueue.splice(0, messagesPerBatch);
      batch.forEach(msg => {
        if (this.isConnected()) {
          this.socket!.emit('message', JSON.stringify(msg));
        }
      });

      if (this.messageQueue.length > 0 && this.isConnected()) {
        setTimeout(sendBatch, batchDelay);
      }
    };

    sendBatch();
  }

  /**
   * Check if connection is active
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /**
   * Get the number of queued messages
   */
  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Disconnect from the relay server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }
}
