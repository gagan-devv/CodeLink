import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProtocolMessage } from '@codelink/protocol';

// Mock socket.io-client - must be defined before vi.mock
const mockSocket = {
  connected: false,
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

import { WebSocketClient } from './WebSocketClient';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let connectHandler: () => void;
  let disconnectHandler: (reason: string) => void;
  let errorHandler: (error: Error) => void;
  let connectErrorHandler: (error: Error) => void;

  beforeEach(async () => {
    const { io } = await import('socket.io-client');
    
    client = new WebSocketClient();
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    vi.mocked(io).mockClear();

    // Capture event handlers
    mockSocket.on.mockImplementation((event: string, handler: any) => {
      if (event === 'connect') connectHandler = handler;
      if (event === 'disconnect') disconnectHandler = handler;
      if (event === 'error') errorHandler = handler;
      if (event === 'connect_error') connectErrorHandler = handler;
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('connect', () => {
    it('should initialize socket connection', async () => {
      const { io } = await import('socket.io-client');
      
      client.connect('http://localhost:3000');

      expect(io).toHaveBeenCalledWith('http://localhost:3000', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
      });
    });

    it('should set up event handlers', () => {
      client.connect('http://localhost:3000');

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should not connect if already connected', async () => {
      const { io } = await import('socket.io-client');
      
      client.connect('http://localhost:3000');
      vi.mocked(io).mockClear();
      
      client.connect('http://localhost:3000');
      
      expect(io).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('should transmit message when connected', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = true;

      const message: ProtocolMessage = {
        id: '123',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'old',
          modifiedFile: 'new',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      client.send(message);

      expect(mockSocket.emit).toHaveBeenCalledWith('message', JSON.stringify(message));
    });

    it('should queue message when disconnected', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = false;

      const message: ProtocolMessage = {
        id: '123',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'old',
          modifiedFile: 'new',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      client.send(message);

      expect(mockSocket.emit).not.toHaveBeenCalled();
      expect(client.getQueueSize()).toBe(1);
    });
  });

  describe('isConnected', () => {
    it('should return true when socket is connected', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = true;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when socket is disconnected', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = false;

      expect(client.isConnected()).toBe(false);
    });

    it('should return false when socket is not initialized', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('message queueing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should queue messages when disconnected', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = false;

      const message1: ProtocolMessage = {
        id: '1',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      const message2: ProtocolMessage = {
        id: '2',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      client.send(message1);
      client.send(message2);

      expect(client.getQueueSize()).toBe(2);
    });

    it('should flush queue on reconnection', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = false;

      const messages: ProtocolMessage[] = [];
      for (let i = 0; i < 5; i++) {
        const msg: ProtocolMessage = {
          id: `${i}`,
          timestamp: Date.now(),
          type: 'ping',
          source: 'extension',
        };
        messages.push(msg);
        client.send(msg);
      }

      expect(client.getQueueSize()).toBe(5);

      mockSocket.connected = true;
      connectHandler();

      vi.runAllTimers();

      expect(mockSocket.emit).toHaveBeenCalledTimes(5);
      expect(client.getQueueSize()).toBe(0);
    });

    it('should drop oldest message when queue is full', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = false;

      for (let i = 0; i < 101; i++) {
        const msg: ProtocolMessage = {
          id: `${i}`,
          timestamp: Date.now(),
          type: 'ping',
          source: 'extension',
        };
        client.send(msg);
      }

      expect(client.getQueueSize()).toBe(100);
    });
  });

  describe('retry logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should handle connection errors with exponential backoff', () => {
      client.connect('http://localhost:3000');

      const error = new Error('Connection failed');
      
      // First error: reconnectAttempts becomes 1, delay = 2^1 * 1000 = 2000ms
      connectErrorHandler(error);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 2000ms'),
        'Connection failed'
      );

      // Second error: reconnectAttempts becomes 2, delay = 2^2 * 1000 = 4000ms
      connectErrorHandler(error);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 4000ms'),
        'Connection failed'
      );

      // Third error: reconnectAttempts becomes 3, delay = 2^3 * 1000 = 5000ms (capped at 5000)
      connectErrorHandler(error);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 5000ms'),
        'Connection failed'
      );
    });

    it('should stop retrying after max attempts', () => {
      client.connect('http://localhost:3000');

      const error = new Error('Connection failed');
      
      for (let i = 0; i < 10; i++) {
        connectErrorHandler(error);
      }

      expect(console.error).toHaveBeenCalledWith('Max reconnection attempts reached');
    });
  });

  describe('connection event handlers', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle disconnect event', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = true;
      connectHandler();

      mockSocket.connected = false;
      disconnectHandler('transport close');

      expect(console.log).toHaveBeenCalledWith('WebSocket disconnected: transport close');
    });

    it('should handle error event', () => {
      client.connect('http://localhost:3000');

      const error = new Error('Socket error');
      errorHandler(error);

      expect(console.error).toHaveBeenCalledWith('WebSocket error:', error);
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket and clear queue', () => {
      client.connect('http://localhost:3000');
      mockSocket.connected = false;

      const message: ProtocolMessage = {
        id: '1',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };
      client.send(message);

      expect(client.getQueueSize()).toBe(1);

      client.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(client.getQueueSize()).toBe(0);
      expect(client.isConnected()).toBe(false);
    });
  });
});
