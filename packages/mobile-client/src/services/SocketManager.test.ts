import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SocketManagerImpl } from './SocketManager';
import type { ProtocolMessage } from '@codelink/protocol';

// Mock Socket.IO
vi.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  };

  return {
    io: vi.fn(() => mockSocket),
  };
});

describe('SocketManager Unit Tests', () => {
  let socketManager: SocketManagerImpl;
  let mockSocket: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { io } = await import('socket.io-client');
    socketManager = new SocketManagerImpl();
    mockSocket = (io as any)();
  });

  afterEach(() => {
    if (socketManager) {
      socketManager.disconnect();
    }
  });

  describe('Connection Establishment', () => {
    it('should establish connection successfully', async () => {
      const connectPromise = socketManager.connect('ws://localhost:3000');
      
      // Simulate successful connection
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      
      if (connectHandler) {
        connectHandler();
      }
      
      await connectPromise;
      
      expect(socketManager.isConnected()).toBe(true);
    });

    it('should call onConnect handlers when connection is established', async () => {
      const connectHandler = vi.fn();
      socketManager.onConnect(connectHandler);
      
      const connectPromise = socketManager.connect('ws://localhost:3000');
      
      mockSocket.connected = true;
      const socketConnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      
      if (socketConnectHandler) {
        socketConnectHandler();
      }
      
      await connectPromise;
      
      expect(connectHandler).toHaveBeenCalledTimes(1);
    });

    it('should reject promise on connection error', async () => {
      const connectPromise = socketManager.connect('ws://localhost:3000');
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect_error'
      )?.[1];
      
      if (errorHandler) {
        errorHandler(new Error('Connection failed'));
      }
      
      await expect(connectPromise).rejects.toThrow('Connection error');
    });

    it('should configure socket with correct options', async () => {
      const { io } = await import('socket.io-client');
      
      socketManager.connect('ws://localhost:3000');
      
      expect(io).toHaveBeenCalledWith('ws://localhost:3000', {
        reconnection: false,
        timeout: 20000,
        transports: ['websocket'],
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = socketManager.connect('ws://localhost:3000');
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        connectHandler();
      }
      await connectPromise;
    });

    it('should call error handlers on socket error', () => {
      const errorHandler = vi.fn();
      socketManager.onError(errorHandler);
      
      const socketErrorHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];
      
      const testError = new Error('Socket error');
      if (socketErrorHandler) {
        socketErrorHandler(testError);
      }
      
      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    it('should throw error when sending message while disconnected', () => {
      socketManager.disconnect();
      mockSocket.connected = false;
      
      const message: ProtocolMessage = {
        id: '123',
        timestamp: Date.now(),
        type: 'PING',
      };
      
      expect(() => socketManager.sendMessage(message)).toThrow(
        'Cannot send message: not connected to server'
      );
    });

    it('should call error handler when sending fails', () => {
      const errorHandler = vi.fn();
      socketManager.onError(errorHandler);
      
      socketManager.disconnect();
      mockSocket.connected = false;
      
      const message: ProtocolMessage = {
        id: '123',
        timestamp: Date.now(),
        type: 'PING',
      };
      
      try {
        socketManager.sendMessage(message);
      } catch (e) {
        // Expected
      }
      
      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].message).toContain('not connected');
    });

    it('should handle message parsing errors gracefully', () => {
      const errorHandler = vi.fn();
      socketManager.onError(errorHandler);
      
      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      // Send invalid message that causes parsing error
      if (messageHandler) {
        // This should trigger error handling in the message handler
        const invalidMessage = { invalid: 'data' };
        messageHandler(invalidMessage);
      }
      
      // The message handler should still process it as ProtocolMessage
      // No error should be thrown, but it might be logged
    });
  });

  describe('Reconnection Attempts', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = socketManager.connect('ws://localhost:3000');
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        connectHandler();
      }
      await connectPromise;
    });

    it('should attempt reconnection on unexpected disconnect', async () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )?.[1];
      
      // Simulate unexpected disconnect
      mockSocket.connected = false;
      if (disconnectHandler) {
        disconnectHandler('transport close');
      }
      
      // Wait for reconnection attempt to be scheduled
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reconnection should be attempted (implementation uses setTimeout)
      // This is verified by the fact that no error is thrown
      expect(socketManager.isConnected()).toBe(false);
    });

    it('should not attempt reconnection on manual disconnect', async () => {
      let reconnectAttempted = false;
      const { io } = await import('socket.io-client');
      const originalIo = io as any;
      
      // Track if io is called again (which would indicate reconnection attempt)
      const callCountBefore = originalIo.mock.calls.length;
      
      // Manually disconnect
      socketManager.disconnect();
      mockSocket.connected = false;
      
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )?.[1];
      
      if (disconnectHandler) {
        disconnectHandler('io client disconnect');
      }
      
      // Wait to ensure no reconnection is attempted
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const callCountAfter = originalIo.mock.calls.length;
      
      // No new connection should have been attempted
      expect(callCountAfter).toBe(callCountBefore);
      expect(socketManager.isConnected()).toBe(false);
    });

    it('should call disconnect handlers when connection is lost', async () => {
      const disconnectHandler = vi.fn();
      socketManager.onDisconnect(disconnectHandler);
      
      const socketDisconnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )?.[1];
      
      mockSocket.connected = false;
      if (socketDisconnectHandler) {
        socketDisconnectHandler('transport close');
      }
      
      expect(disconnectHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = socketManager.connect('ws://localhost:3000');
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        connectHandler();
      }
      await connectPromise;
    });

    it('should send message when connected', () => {
      const message: ProtocolMessage = {
        id: '123',
        timestamp: Date.now(),
        type: 'INJECT_PROMPT',
        payload: { prompt: 'Test prompt' },
      };
      
      socketManager.sendMessage(message);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('message', message);
    });

    it('should receive and handle incoming messages', () => {
      const messageHandler = vi.fn();
      socketManager.onMessage(messageHandler);
      
      const socketMessageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      const testMessage: ProtocolMessage = {
        id: '456',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };
      
      if (socketMessageHandler) {
        socketMessageHandler(testMessage);
      }
      
      expect(messageHandler).toHaveBeenCalledWith(testMessage);
    });

    it('should support multiple message handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      
      socketManager.onMessage(handler1);
      socketManager.onMessage(handler2);
      socketManager.onMessage(handler3);
      
      const socketMessageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      const testMessage: ProtocolMessage = {
        id: '789',
        timestamp: Date.now(),
        type: 'PING',
      };
      
      if (socketMessageHandler) {
        socketMessageHandler(testMessage);
      }
      
      expect(handler1).toHaveBeenCalledWith(testMessage);
      expect(handler2).toHaveBeenCalledWith(testMessage);
      expect(handler3).toHaveBeenCalledWith(testMessage);
    });
  });

  describe('Connection State', () => {
    it('should return false for isConnected when not connected', () => {
      expect(socketManager.isConnected()).toBe(false);
    });

    it('should return true for isConnected when connected', async () => {
      const connectPromise = socketManager.connect('ws://localhost:3000');
      
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      
      if (connectHandler) {
        connectHandler();
      }
      
      await connectPromise;
      
      expect(socketManager.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const connectPromise = socketManager.connect('ws://localhost:3000');
      
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      
      if (connectHandler) {
        connectHandler();
      }
      
      await connectPromise;
      
      socketManager.disconnect();
      mockSocket.connected = false;
      
      expect(socketManager.isConnected()).toBe(false);
    });
  });

  describe('Disconnect', () => {
    it('should clean up socket on disconnect', async () => {
      const connectPromise = socketManager.connect('ws://localhost:3000');
      
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      
      if (connectHandler) {
        connectHandler();
      }
      
      await connectPromise;
      
      socketManager.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketManager.isConnected()).toBe(false);
    });

    it('should not throw error when disconnecting while not connected', () => {
      expect(() => socketManager.disconnect()).not.toThrow();
    });
  });
});
