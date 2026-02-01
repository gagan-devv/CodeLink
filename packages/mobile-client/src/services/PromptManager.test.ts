import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptManagerImpl } from './PromptManager';
import type { SocketManager } from './SocketManager';
import type { InjectPromptMessage, InjectPromptResponse } from '@codelink/protocol';

describe('PromptManager - Unit Tests', () => {
  let mockSocketManager: SocketManager;
  let sentMessages: InjectPromptMessage[];

  beforeEach(() => {
    sentMessages = [];
    
    mockSocketManager = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      sendMessage: vi.fn((message) => {
        sentMessages.push(message as InjectPromptMessage);
      }),
      onMessage: vi.fn(),
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
    };
  });

  describe('submitPrompt', () => {
    it('should submit a valid prompt and return message ID', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const prompt = 'Test prompt';
      
      const messageId = manager.submitPrompt(prompt);
      
      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
      expect(messageId.length).toBeGreaterThan(0);
      expect(mockSocketManager.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should trim whitespace from prompt before submission', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const prompt = '  Test prompt with spaces  ';
      
      manager.submitPrompt(prompt);
      
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].payload.prompt).toBe('Test prompt with spaces');
    });

    it('should throw error for empty prompt', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      
      expect(() => manager.submitPrompt('')).toThrow('Prompt cannot be empty');
      expect(() => manager.submitPrompt('   ')).toThrow('Prompt cannot be empty');
      expect(mockSocketManager.sendMessage).not.toHaveBeenCalled();
    });

    it('should throw error when not connected', () => {
      const disconnectedSocketManager = {
        ...mockSocketManager,
        isConnected: vi.fn(() => false),
      };
      const manager = new PromptManagerImpl(disconnectedSocketManager);
      
      expect(() => manager.submitPrompt('Test prompt')).toThrow('not connected to server');
      expect(disconnectedSocketManager.sendMessage).not.toHaveBeenCalled();
    });

    it('should store prompt in pending prompts map', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const prompt = 'Test prompt';
      
      const messageId = manager.submitPrompt(prompt);
      const status = manager.getPromptStatus(messageId);
      
      expect(status).not.toBeNull();
      expect(status?.id).toBe(messageId);
      expect(status?.prompt).toBe(prompt);
      expect(status?.status).toBe('pending');
    });

    it('should remove prompt from pending if send fails', () => {
      const failingSocketManager = {
        ...mockSocketManager,
        sendMessage: vi.fn(() => {
          throw new Error('Send failed');
        }),
      };
      const manager = new PromptManagerImpl(failingSocketManager);
      const prompt = 'Test prompt';
      
      expect(() => manager.submitPrompt(prompt)).toThrow('Send failed');
      
      const pendingPrompts = manager.getPendingPrompts();
      expect(pendingPrompts).toHaveLength(0);
    });

    it('should generate unique message IDs for multiple prompts', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      
      const id1 = manager.submitPrompt('Prompt 1');
      const id2 = manager.submitPrompt('Prompt 2');
      const id3 = manager.submitPrompt('Prompt 3');
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('handleResponse', () => {
    it('should update prompt status to success for successful response', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const messageId = manager.submitPrompt('Test prompt');
      
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-123',
        timestamp: Date.now(),
        originalId: messageId,
        payload: {
          success: true,
          editorUsed: 'Kiro'
        }
      };
      
      manager.handleResponse(response);
      
      const status = manager.getPromptStatus(messageId);
      expect(status?.status).toBe('success');
    });

    it('should update prompt status to error for failed response', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const messageId = manager.submitPrompt('Test prompt');
      
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-123',
        timestamp: Date.now(),
        originalId: messageId,
        payload: {
          success: false,
          error: 'Processing failed'
        }
      };
      
      manager.handleResponse(response);
      
      const status = manager.getPromptStatus(messageId);
      expect(status?.status).toBe('error');
    });

    it('should invoke registered response callbacks', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const callback = vi.fn();
      manager.onResponse(callback);
      
      const messageId = manager.submitPrompt('Test prompt');
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-123',
        timestamp: Date.now(),
        originalId: messageId,
        payload: {
          success: true,
          editorUsed: 'Continue'
        }
      };
      
      manager.handleResponse(response);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(response);
    });

    it('should handle response for unknown prompt ID gracefully', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-123',
        timestamp: Date.now(),
        originalId: 'unknown-id',
        payload: {
          success: true,
          editorUsed: 'Kiro'
        }
      };
      
      expect(() => manager.handleResponse(response)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown prompt ID')
      );
      
      consoleSpy.mockRestore();
    });

    it('should invoke multiple registered callbacks', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      
      manager.onResponse(callback1);
      manager.onResponse(callback2);
      manager.onResponse(callback3);
      
      const messageId = manager.submitPrompt('Test prompt');
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-123',
        timestamp: Date.now(),
        originalId: messageId,
        payload: {
          success: true,
          editorUsed: 'Cursor'
        }
      };
      
      manager.handleResponse(response);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  describe('status queries', () => {
    it('should return all pending prompts', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      
      manager.submitPrompt('Prompt 1');
      manager.submitPrompt('Prompt 2');
      manager.submitPrompt('Prompt 3');
      
      const pendingPrompts = manager.getPendingPrompts();
      
      expect(pendingPrompts).toHaveLength(3);
      expect(pendingPrompts[0].prompt).toBe('Prompt 1');
      expect(pendingPrompts[1].prompt).toBe('Prompt 2');
      expect(pendingPrompts[2].prompt).toBe('Prompt 3');
    });

    it('should return null for non-existent prompt ID', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      
      const status = manager.getPromptStatus('non-existent-id');
      
      expect(status).toBeNull();
    });

    it('should return correct status for existing prompt', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      const messageId = manager.submitPrompt('Test prompt');
      
      const status = manager.getPromptStatus(messageId);
      
      expect(status).not.toBeNull();
      expect(status?.id).toBe(messageId);
      expect(status?.prompt).toBe('Test prompt');
      expect(status?.status).toBe('pending');
      expect(status?.timestamp).toBeGreaterThan(0);
    });

    it('should return empty array when no prompts are pending', () => {
      const manager = new PromptManagerImpl(mockSocketManager);
      
      const pendingPrompts = manager.getPendingPrompts();
      
      expect(pendingPrompts).toHaveLength(0);
    });
  });
});
