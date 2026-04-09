import { describe, it, expect } from 'vitest';
import {
  MessageType,
  PingMessage,
  PongMessage,
  FileContextPayload,
  SyncFullContextMessage,
  InjectPromptMessage,
  InjectPromptResponse,
} from './index';

describe('Protocol Package - Smoke Tests', () => {
  describe('MessageType Enum', () => {
    it('should have all required message types', () => {
      expect(MessageType.PING).toBe('PING');
      expect(MessageType.PONG).toBe('PONG');
      expect(MessageType.SYNC_FULL_CONTEXT).toBe('SYNC_FULL_CONTEXT');
      expect(MessageType.INJECT_PROMPT).toBe('INJECT_PROMPT');
      expect(MessageType.INJECT_PROMPT_RESPONSE).toBe('INJECT_PROMPT_RESPONSE');
    });
  });

  describe('PingMessage', () => {
    it('should create a valid ping message', () => {
      const ping: PingMessage = {
        id: 'test-id',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      expect(ping.id).toBe('test-id');
      expect(ping.type).toBe('ping');
      expect(ping.source).toBe('extension');
      expect(typeof ping.timestamp).toBe('number');
    });
  });

  describe('PongMessage', () => {
    it('should create a valid pong message', () => {
      const pong: PongMessage = {
        id: 'pong-id',
        timestamp: Date.now(),
        type: 'pong',
        originalId: 'ping-id',
      };

      expect(pong.id).toBe('pong-id');
      expect(pong.type).toBe('pong');
      expect(pong.originalId).toBe('ping-id');
      expect(typeof pong.timestamp).toBe('number');
    });
  });

  describe('FileContextPayload', () => {
    it('should create a valid file context payload', () => {
      const payload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'original content',
        modifiedFile: 'modified content',
        isDirty: true,
        timestamp: Date.now(),
      };

      expect(payload.fileName).toBe('src/test.ts');
      expect(payload.originalFile).toBe('original content');
      expect(payload.modifiedFile).toBe('modified content');
      expect(payload.isDirty).toBe(true);
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  describe('SyncFullContextMessage', () => {
    it('should create a valid sync full context message', () => {
      const message: SyncFullContextMessage = {
        id: 'sync-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'src/test.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      expect(message.id).toBe('sync-id');
      expect(message.type).toBe('SYNC_FULL_CONTEXT');
      expect(message.payload.fileName).toBe('src/test.ts');
      expect(typeof message.timestamp).toBe('number');
    });
  });

  describe('InjectPromptMessage', () => {
    it('should create a valid inject prompt message', () => {
      const message: InjectPromptMessage = {
        id: 'prompt-id',
        timestamp: Date.now(),
        type: 'INJECT_PROMPT',
        payload: {
          prompt: 'Test prompt',
        },
      };

      expect(message.id).toBe('prompt-id');
      expect(message.type).toBe('INJECT_PROMPT');
      expect(message.payload.prompt).toBe('Test prompt');
      expect(typeof message.timestamp).toBe('number');
    });
  });

  describe('InjectPromptResponse', () => {
    it('should create a valid inject prompt response (success)', () => {
      const response: InjectPromptResponse = {
        id: 'response-id',
        timestamp: Date.now(),
        type: 'INJECT_PROMPT_RESPONSE',
        originalId: 'prompt-id',
        payload: {
          success: true,
          editorUsed: 'continue',
        },
      };

      expect(response.id).toBe('response-id');
      expect(response.type).toBe('INJECT_PROMPT_RESPONSE');
      expect(response.originalId).toBe('prompt-id');
      expect(response.payload.success).toBe(true);
      expect(response.payload.editorUsed).toBe('continue');
    });

    it('should create a valid inject prompt response (error)', () => {
      const response: InjectPromptResponse = {
        id: 'response-id',
        timestamp: Date.now(),
        type: 'INJECT_PROMPT_RESPONSE',
        originalId: 'prompt-id',
        payload: {
          success: false,
          error: 'No editor found',
        },
      };

      expect(response.id).toBe('response-id');
      expect(response.payload.success).toBe(false);
      expect(response.payload.error).toBe('No editor found');
    });
  });
});
