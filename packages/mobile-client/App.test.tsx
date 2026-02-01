import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptManagerImpl } from './src/services/PromptManager';
import { DiffMessageHandler } from './src/services/DiffMessageHandler';
import { SocketManagerImpl } from './src/services/SocketManager';
import type { InjectPromptResponse, SyncFullContextMessage } from '@codelink/protocol';

// Mock socket.io-client
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

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete prompt submission flow', () => {
    it('should submit prompt through PromptManager and handle response', async () => {
      const { io } = await import('socket.io-client');
      const mockSocket: any = io();
      mockSocket.connected = true;

      const socketManager = new SocketManagerImpl();
      const promptManager = new PromptManagerImpl(socketManager);

      // Start connection (don't await - let it run in background)
      socketManager.connect('ws://localhost:3000');
      
      // Immediately trigger connect handler to simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      // Submit prompt
      const messageId = promptManager.submitPrompt('Test integration prompt');
      expect(messageId).toBeTruthy();

      // Verify message was sent
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'message',
        expect.stringContaining('"type":"INJECT_PROMPT"')
      );
      
      // Verify the JSON string contains the prompt
      const sentMessage = mockSocket.emit.mock.calls[0][1];
      const parsedMessage = JSON.parse(sentMessage);
      expect(parsedMessage.type).toBe('INJECT_PROMPT');
      expect(parsedMessage.payload.prompt).toBe('Test integration prompt');

      // Simulate response
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-123',
        timestamp: Date.now(),
        originalId: messageId,
        payload: {
          success: true,
          editorUsed: 'Kiro',
        },
      };

      let responseReceived = false;
      promptManager.onResponse((resp) => {
        expect(resp.payload.success).toBe(true);
        expect(resp.payload.editorUsed).toBe('Kiro');
        responseReceived = true;
      });

      promptManager.handleResponse(response);
      expect(responseReceived).toBe(true);
    });

    it('should handle error response correctly', async () => {
      const { io } = await import('socket.io-client');
      const mockSocket: any = io();
      mockSocket.connected = true;

      const socketManager = new SocketManagerImpl();
      const promptManager = new PromptManagerImpl(socketManager);

      // Start connection and trigger connect handler
      socketManager.connect('ws://localhost:3000');
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      const messageId = promptManager.submitPrompt('Test error prompt');

      const errorResponse: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-456',
        timestamp: Date.now(),
        originalId: messageId,
        payload: {
          success: false,
          error: 'Editor not available',
        },
      };

      let errorReceived = false;
      promptManager.onResponse((resp) => {
        expect(resp.payload.success).toBe(false);
        expect(resp.payload.error).toBe('Editor not available');
        errorReceived = true;
      });

      promptManager.handleResponse(errorResponse);
      expect(errorReceived).toBe(true);
    });
  });

  describe('Diff viewing flow', () => {
    it('should receive and process SYNC_FULL_CONTEXT message', () => {
      const diffHandler = new DiffMessageHandler(50);

      const diffMessage: SyncFullContextMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'diff-123',
        timestamp: Date.now(),
        payload: {
          fileName: 'test.ts',
          originalFile: 'const x = 1;',
          modifiedFile: 'const x = 2;',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      let stateUpdated = false;
      diffHandler.onStateChange((state) => {
        expect(state.currentDiff).toBeTruthy();
        expect(state.currentDiff?.fileName).toBe('test.ts');
        stateUpdated = true;
      });

      const result = diffHandler.handleMessage(diffMessage);
      expect(result).toBe(true);
      expect(stateUpdated).toBe(true);
    });
  });

  describe('Connection loss and recovery', () => {
    it('should handle connection state transitions', async () => {
      const { io } = await import('socket.io-client');
      const mockSocket: any = io();

      const socketManager = new SocketManagerImpl();

      let connectCalled = false;
      let disconnectCalled = false;

      socketManager.onConnect(() => {
        connectCalled = true;
      });

      socketManager.onDisconnect(() => {
        disconnectCalled = true;
      });

      // Initiate connection
      socketManager.connect('ws://localhost:3000');

      // Simulate connection
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      expect(connectCalled).toBe(true);

      // Simulate disconnection
      mockSocket.connected = false;
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];
      if (disconnectHandler) disconnectHandler('transport close');

      expect(disconnectCalled).toBe(true);
    });

    it('should prevent message sending when disconnected', () => {
      const { io } = require('socket.io-client');
      const mockSocket: any = io();
      mockSocket.connected = false;

      const socketManager = new SocketManagerImpl();
      const promptManager = new PromptManagerImpl(socketManager);

      expect(() => {
        promptManager.submitPrompt('Test prompt while disconnected');
      }).toThrow(/not connected/i);
    });
  });

  describe('Message routing integration', () => {
    it('should route messages to appropriate handlers', async () => {
      const { io } = await import('socket.io-client');
      const mockSocket: any = io();
      mockSocket.connected = true;

      const socketManager = new SocketManagerImpl();
      const promptManager = new PromptManagerImpl(socketManager);
      const diffHandler = new DiffMessageHandler(50);

      // Initiate connection
      socketManager.connect('ws://localhost:3000');
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      // Set up message routing
      socketManager.onMessage((message: any) => {
        if (message.type === 'INJECT_PROMPT_RESPONSE') {
          promptManager.handleResponse(message);
        } else if (message.type === 'SYNC_FULL_CONTEXT') {
          diffHandler.handleMessage(message);
        }
      });

      // Simulate receiving messages
      const messageHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'message'
      )?.[1];

      let promptResponseHandled = false;
      promptManager.onResponse(() => {
        promptResponseHandled = true;
      });

      let diffStateUpdated = false;
      diffHandler.onStateChange(() => {
        diffStateUpdated = true;
      });

      // Send prompt first to get message ID
      const messageId = promptManager.submitPrompt('Test routing');

      // Route prompt response (messages are now JSON strings)
      const promptResponse: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'resp-1',
        timestamp: Date.now(),
        originalId: messageId,
        payload: { success: true },
      };

      if (messageHandler) messageHandler(JSON.stringify(promptResponse));
      expect(promptResponseHandled).toBe(true);

      // Route diff message (messages are now JSON strings)
      const diffMessage: SyncFullContextMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'diff-1',
        timestamp: Date.now(),
        payload: {
          fileName: 'app.ts',
          originalFile: 'old',
          modifiedFile: 'new',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      if (messageHandler) messageHandler(JSON.stringify(diffMessage));
      expect(diffStateUpdated).toBe(true);
    });
  });
});
