import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient, ConnectionStatus } from './WebSocketClient';
import { FileContextPayload, SyncFullContextMessage } from '@codelink/protocol';
import { io, Socket } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mockSocket: any;
  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    eventHandlers = {};
    
    mockSocket = {
      on: vi.fn((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
      emit: vi.fn(),
      close: vi.fn(),
      connected: true,
    };

    (io as any).mockReturnValue(mockSocket);
    
    client = new WebSocketClient({ url: 'http://localhost:8080' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connection management', () => {
    it('should connect to relay server', () => {
      client.connect();

      expect(io).toHaveBeenCalledWith('http://localhost:8080', expect.objectContaining({
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      }));
    });

    it('should update status to connecting when connect is called', () => {
      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      expect(statusCallback).toHaveBeenCalledWith('connecting');
    });

    it('should update status to connected on connect event', () => {
      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);
      client.connect();

      statusCallback.mockClear();
      eventHandlers['connect']();

      expect(statusCallback).toHaveBeenCalledWith('connected');
      expect(client.isConnected()).toBe(true);
    });

    it('should update status to disconnected on disconnect event', () => {
      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);
      client.connect();
      eventHandlers['connect']();

      statusCallback.mockClear();
      eventHandlers['disconnect']();

      expect(statusCallback).toHaveBeenCalledWith('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should handle connection errors', () => {
      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);
      client.connect();

      statusCallback.mockClear();
      const error = new Error('Connection failed');
      eventHandlers['connect_error'](error);

      expect(statusCallback).toHaveBeenCalledWith('disconnected');
    });

    it('should disconnect and clean up socket', () => {
      client.connect();
      eventHandlers['connect']();

      client.disconnect();

      expect(mockSocket.close).toHaveBeenCalled();
      expect(client.getStatus()).toBe('disconnected');
    });

    it('should not create multiple connections', () => {
      client.connect();
      client.connect();

      expect(io).toHaveBeenCalledTimes(1);
    });
  });

  describe('SYNC_FULL_CONTEXT message parsing', () => {
    it('should parse valid SYNC_FULL_CONTEXT message', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      const payload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'original content',
        modifiedFile: 'modified content',
        isDirty: true,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'test-id',
        type: 'SYNC_FULL_CONTEXT',
        payload,
        timestamp: Date.now(),
      };

      eventHandlers['message'](JSON.stringify(message));

      expect(payloadCallback).toHaveBeenCalledWith(payload);
    });

    it('should validate payload structure', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      const invalidMessage = {
        id: 'test-id',
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          // Missing required fields
        },
        timestamp: Date.now(),
      };

      eventHandlers['message'](JSON.stringify(invalidMessage));

      expect(payloadCallback).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON messages', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      // Should not throw error
      expect(() => {
        eventHandlers['message']('invalid json {');
      }).not.toThrow();

      expect(payloadCallback).not.toHaveBeenCalled();
    });

    it('should ignore non-SYNC_FULL_CONTEXT messages', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      const pingMessage = {
        id: 'test-id',
        type: 'ping',
        timestamp: Date.now(),
      };

      eventHandlers['message'](JSON.stringify(pingMessage));

      expect(payloadCallback).not.toHaveBeenCalled();
    });
  });

  describe('payload storage in state', () => {
    it('should invoke callback when valid payload is received', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      const payload: FileContextPayload = {
        fileName: 'src/index.ts',
        originalFile: 'const x = 1;',
        modifiedFile: 'const x = 2;',
        isDirty: false,
        timestamp: 1234567890,
      };

      const message: SyncFullContextMessage = {
        id: 'msg-1',
        type: 'SYNC_FULL_CONTEXT',
        payload,
        timestamp: Date.now(),
      };

      eventHandlers['message'](JSON.stringify(message));

      expect(payloadCallback).toHaveBeenCalledTimes(1);
      expect(payloadCallback).toHaveBeenCalledWith(payload);
    });

    it('should handle multiple payloads sequentially', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      const payload1: FileContextPayload = {
        fileName: 'file1.ts',
        originalFile: 'content1',
        modifiedFile: 'modified1',
        isDirty: true,
        timestamp: 1000,
      };

      const payload2: FileContextPayload = {
        fileName: 'file2.ts',
        originalFile: 'content2',
        modifiedFile: 'modified2',
        isDirty: false,
        timestamp: 2000,
      };

      eventHandlers['message'](JSON.stringify({
        id: 'msg-1',
        type: 'SYNC_FULL_CONTEXT',
        payload: payload1,
        timestamp: Date.now(),
      }));

      eventHandlers['message'](JSON.stringify({
        id: 'msg-2',
        type: 'SYNC_FULL_CONTEXT',
        payload: payload2,
        timestamp: Date.now(),
      }));

      expect(payloadCallback).toHaveBeenCalledTimes(2);
      expect(payloadCallback).toHaveBeenNthCalledWith(1, payload1);
      expect(payloadCallback).toHaveBeenNthCalledWith(2, payload2);
    });
  });

  describe('error handling', () => {
    it('should continue operation after parse error', () => {
      const payloadCallback = vi.fn();
      client.onPayload(payloadCallback);
      client.connect();

      // Send malformed message
      eventHandlers['message']('invalid json');

      // Send valid message after error
      const payload: FileContextPayload = {
        fileName: 'test.ts',
        originalFile: 'original',
        modifiedFile: 'modified',
        isDirty: true,
        timestamp: Date.now(),
      };

      eventHandlers['message'](JSON.stringify({
        id: 'msg-1',
        type: 'SYNC_FULL_CONTEXT',
        payload,
        timestamp: Date.now(),
      }));

      expect(payloadCallback).toHaveBeenCalledWith(payload);
    });

    it('should handle missing payload callback gracefully', () => {
      client.connect();

      const payload: FileContextPayload = {
        fileName: 'test.ts',
        originalFile: 'original',
        modifiedFile: 'modified',
        isDirty: true,
        timestamp: Date.now(),
      };

      expect(() => {
        eventHandlers['message'](JSON.stringify({
          id: 'msg-1',
          type: 'SYNC_FULL_CONTEXT',
          payload,
          timestamp: Date.now(),
        }));
      }).not.toThrow();
    });
  });

  describe('reconnection logic', () => {
    it('should configure reconnection parameters', () => {
      const customClient = new WebSocketClient({
        url: 'http://localhost:8080',
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 5,
      });

      customClient.connect();

      expect(io).toHaveBeenCalledWith('http://localhost:8080', expect.objectContaining({
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 5,
      }));
    });

    it('should use default reconnection parameters', () => {
      client.connect();

      expect(io).toHaveBeenCalledWith('http://localhost:8080', expect.objectContaining({
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      }));
    });
  });
});
