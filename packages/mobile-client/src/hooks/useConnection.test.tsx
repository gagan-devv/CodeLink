import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SocketManagerImpl } from '../services/SocketManager';
import { ConnectionStatusProvider, useConnection } from './useConnection';

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

describe('ConnectionStatusProvider Unit Tests', () => {
  let mockSocket: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Get the mock socket
    const { io } = await import('socket.io-client');
    mockSocket = (io as any)();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ConnectionStatusProvider', () => {
    it('should create a provider component', () => {
      expect(ConnectionStatusProvider).toBeDefined();
      expect(typeof ConnectionStatusProvider).toBe('function');
    });

    it('should accept children and serverUrl props', () => {
      const provider = ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://localhost:3000'
      });
      
      expect(provider).toBeDefined();
    });

    it('should use default server URL when not provided', () => {
      const provider = ConnectionStatusProvider({
        children: null
      });
      
      expect(provider).toBeDefined();
    });
  });

  describe('useConnection hook', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        // Simulate calling the hook outside of provider context
        useConnection();
      }).toThrow('useConnection must be used within ConnectionStatusProvider');
    });
  });

  describe('SocketManager integration', () => {
    it('should initialize SocketManager on mount', async () => {
      const { io } = await import('socket.io-client');
      
      // Create provider (simulates mounting)
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Verify io was called to create socket
      expect(io).toHaveBeenCalled();
    });

    it('should register event handlers on SocketManager', async () => {
      // Create provider
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Verify event handlers were registered
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connect event', async () => {
      // Create provider
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Get the connect handler
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect'
      )?.[1];
      
      expect(connectHandler).toBeDefined();
      
      // Simulate connection
      mockSocket.connected = true;
      if (connectHandler) {
        connectHandler();
      }
      
      // Handler should execute without errors
      expect(mockSocket.connected).toBe(true);
    });

    it('should handle disconnect event', async () => {
      // Create provider
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Get the disconnect handler
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )?.[1];
      
      expect(disconnectHandler).toBeDefined();
      
      // Simulate disconnection
      mockSocket.connected = false;
      if (disconnectHandler) {
        disconnectHandler('transport close');
      }
      
      // Handler should execute without errors
      expect(mockSocket.connected).toBe(false);
    });

    it('should handle error event', async () => {
      // Create provider
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Get the error handler
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'connect_error'
      )?.[1];
      
      expect(errorHandler).toBeDefined();
      
      // Simulate error
      const testError = new Error('Connection failed');
      if (errorHandler) {
        errorHandler(testError);
      }
      
      // Handler should execute without errors
      expect(errorHandler).toBeDefined();
    });
  });

  describe('Connection lifecycle', () => {
    it('should attempt initial connection on mount', async () => {
      const { io } = await import('socket.io-client');
      
      // Create provider
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Verify connection was attempted
      expect(io).toHaveBeenCalledWith('ws://test:3000', expect.any(Object));
    });

    it('should pass correct socket options', async () => {
      const { io } = await import('socket.io-client');
      
      // Create provider
      ConnectionStatusProvider({
        children: null,
        serverUrl: 'ws://test:3000'
      });
      
      // Verify socket options
      expect(io).toHaveBeenCalledWith('ws://test:3000', {
        reconnection: false,
        timeout: 20000,
        transports: ['websocket'],
      });
    });
  });
});
