import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
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
      const { container } = render(
        <ConnectionStatusProvider serverUrl="ws://localhost:3000">
          <div>Test Child</div>
        </ConnectionStatusProvider>
      );
      
      expect(container).toBeDefined();
      expect(container.textContent).toBe('Test Child');
    });

    it('should use default server URL when not provided', () => {
      const { container } = render(
        <ConnectionStatusProvider>
          <div>Test Child</div>
        </ConnectionStatusProvider>
      );
      
      expect(container).toBeDefined();
    });
  });

  describe('useConnection hook', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useConnection());
      }).toThrow('useConnection must be used within ConnectionStatusProvider');
    });
  });

  describe('SocketManager integration', () => {
    it('should initialize SocketManager on mount', async () => {
      const { io } = await import('socket.io-client');
      
      // Render provider (simulates mounting)
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Verify io was called to create socket
      await waitFor(() => {
        expect(io).toHaveBeenCalled();
      });
    });

    it('should register event handlers on SocketManager', async () => {
      // Render provider
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Verify event handlers were registered
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      });
    });

    it('should handle connect event', async () => {
      // Render provider
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Wait for handlers to be registered
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
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
      // Render provider
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Wait for handlers to be registered
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
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
      // Render provider
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Wait for handlers to be registered
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
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
      
      // Render provider
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Verify connection was attempted
      await waitFor(() => {
        expect(io).toHaveBeenCalledWith('ws://test:3000', expect.any(Object));
      });
    });

    it('should pass correct socket options', async () => {
      const { io } = await import('socket.io-client');
      
      // Render provider
      render(
        <ConnectionStatusProvider serverUrl="ws://test:3000">
          <div>Test</div>
        </ConnectionStatusProvider>
      );
      
      // Verify socket options
      await waitFor(() => {
        expect(io).toHaveBeenCalledWith('ws://test:3000', {
          reconnection: false,
          timeout: 20000,
          transports: ['websocket'],
        });
      });
    });
  });
});
