import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebSocketClient } from './WebSocketClient';
import { FileContextPayload } from '@codelink/protocol';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
    connected: false,
  };

  return {
    io: vi.fn(() => mockSocket),
    __mockSocket: mockSocket,
  };
});

describe('Mobile Client WebSocket Error Handling', () => {
  let client: WebSocketClient;
  let mockSocket: any;

  beforeEach(async () => {
    const socketIo = await import('socket.io-client');
    mockSocket = (socketIo as any).__mockSocket;
    mockSocket.connected = false;

    vi.clearAllMocks();

    client = new WebSocketClient({ url: 'http://localhost:8080' });
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Parse Error Handling', () => {
    it('should handle malformed JSON gracefully', () => {
      client.connect();

      // Get the message handler
      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      expect(messageHandler).toBeDefined();

      // Send malformed JSON
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => messageHandler('not valid json {')).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing message'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid message structure', () => {
      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Send message with missing type field
      const invalidMessage = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        // missing type field
      });

      expect(() => messageHandler(invalidMessage)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle missing payload fields', () => {
      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Send SYNC_FULL_CONTEXT with incomplete payload
      const incompleteMessage = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          // missing other required fields
        },
      });

      expect(() => messageHandler(incompleteMessage)).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid payload structure'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle null payload', () => {
      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const nullPayloadMessage = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: null,
      });

      expect(() => messageHandler(nullPayloadMessage)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle undefined payload fields', () => {
      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const undefinedFieldsMessage = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: undefined,
          modifiedFile: 'content',
          isDirty: false,
          timestamp: Date.now(),
        },
      });

      expect(() => messageHandler(undefinedFieldsMessage)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should continue operation after parse error', () => {
      let payloadReceived: FileContextPayload | null = null;
      client.onPayload((payload) => {
        payloadReceived = payload;
      });

      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // First message is malformed
      messageHandler('invalid json');
      expect(payloadReceived).toBeNull();

      // Second message is valid
      const validPayload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'old',
        modifiedFile: 'new',
        isDirty: false,
        timestamp: Date.now(),
      };

      const validMessage = JSON.stringify({
        id: 'valid-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: validPayload,
      });

      messageHandler(validMessage);
      expect(payloadReceived).toEqual(validPayload);

      consoleSpy.mockRestore();
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle connection errors', () => {
      client.connect();

      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect_error'
      )?.[1];

      expect(errorHandler).toBeDefined();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Connection refused');
      expect(() => errorHandler(error)).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection error'),
        error
      );

      consoleSpy.mockRestore();
    });

    it('should update status to disconnected on connection error', () => {
      let currentStatus = client.getStatus();
      expect(currentStatus).toBe('disconnected');

      client.onStatusChange((status) => {
        currentStatus = status;
      });

      client.connect();

      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect_error'
      )?.[1];

      errorHandler(new Error('Network error'));

      expect(currentStatus).toBe('disconnected');
    });

    it('should handle disconnect events', () => {
      client.connect();

      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )?.[1];

      expect(disconnectHandler).toBeDefined();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => disconnectHandler()).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Disconnected from relay server')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Payload Validation', () => {
    it('should reject payload with wrong field types', () => {
      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // isDirty should be boolean, not string
      const wrongTypeMessage = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'old',
          modifiedFile: 'new',
          isDirty: 'true', // wrong type
          timestamp: Date.now(),
        },
      });

      expect(() => messageHandler(wrongTypeMessage)).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid payload structure'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should reject payload with missing fileName', () => {
      client.connect();

      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const missingFileNameMessage = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          // missing fileName
          originalFile: 'old',
          modifiedFile: 'new',
          isDirty: false,
          timestamp: Date.now(),
        },
      });

      expect(() => messageHandler(missingFileNameMessage)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
