import { describe, it, expect } from 'vitest';
import {
  isInjectPromptMessage,
  isInjectPromptResponse,
  isSyncFullContextMessage,
  validateProtocolMessage,
  discriminateMessageType,
} from './messageValidation';
import type {
  InjectPromptMessage,
  InjectPromptResponse,
  SyncFullContextMessage,
} from '@codelink/protocol';

describe('Message Validation Unit Tests', () => {
  describe('isInjectPromptMessage', () => {
    it('should return true for valid InjectPromptMessage', () => {
      const validMessage: InjectPromptMessage = {
        type: 'INJECT_PROMPT',
        id: 'test-id-123',
        timestamp: Date.now(),
        payload: {
          prompt: 'Test prompt',
        },
      };

      expect(isInjectPromptMessage(validMessage)).toBe(true);
    });

    it('should return false for message with wrong type', () => {
      const invalidMessage = {
        type: 'WRONG_TYPE',
        id: 'test-id-123',
        timestamp: Date.now(),
        payload: {
          prompt: 'Test prompt',
        },
      };

      expect(isInjectPromptMessage(invalidMessage)).toBe(false);
    });

    it('should return false for message missing payload', () => {
      const invalidMessage = {
        type: 'INJECT_PROMPT',
        id: 'test-id-123',
        timestamp: Date.now(),
      };

      expect(isInjectPromptMessage(invalidMessage)).toBe(false);
    });

    it('should return false for message with invalid payload', () => {
      const invalidMessage = {
        type: 'INJECT_PROMPT',
        id: 'test-id-123',
        timestamp: Date.now(),
        payload: {
          wrongField: 'value',
        },
      };

      expect(isInjectPromptMessage(invalidMessage)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isInjectPromptMessage(null)).toBe(false);
      expect(isInjectPromptMessage(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isInjectPromptMessage('string')).toBe(false);
      expect(isInjectPromptMessage(123)).toBe(false);
      expect(isInjectPromptMessage(true)).toBe(false);
    });
  });

  describe('isInjectPromptResponse', () => {
    it('should return true for valid InjectPromptResponse with success', () => {
      const validMessage: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        originalId: 'original-id-456',
        payload: {
          success: true,
          editorUsed: 'Kiro',
        },
      };

      expect(isInjectPromptResponse(validMessage)).toBe(true);
    });

    it('should return true for valid InjectPromptResponse with error', () => {
      const validMessage: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        originalId: 'original-id-456',
        payload: {
          success: false,
          error: 'Something went wrong',
        },
      };

      expect(isInjectPromptResponse(validMessage)).toBe(true);
    });

    it('should return true for valid message with all optional fields', () => {
      const validMessage: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        originalId: 'original-id-456',
        payload: {
          success: true,
          error: 'Warning message',
          editorUsed: 'Continue',
        },
      };

      expect(isInjectPromptResponse(validMessage)).toBe(true);
    });

    it('should return false for message missing originalId', () => {
      const invalidMessage = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        payload: {
          success: true,
        },
      };

      expect(isInjectPromptResponse(invalidMessage)).toBe(false);
    });

    it('should return false for message with invalid payload.success type', () => {
      const invalidMessage = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        originalId: 'original-id-456',
        payload: {
          success: 'true', // Should be boolean
        },
      };

      expect(isInjectPromptResponse(invalidMessage)).toBe(false);
    });

    it('should return false for message with invalid optional field types', () => {
      const invalidMessage1 = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        originalId: 'original-id-456',
        payload: {
          success: true,
          error: 123, // Should be string
        },
      };

      const invalidMessage2 = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'response-id-123',
        timestamp: Date.now(),
        originalId: 'original-id-456',
        payload: {
          success: true,
          editorUsed: 456, // Should be string
        },
      };

      expect(isInjectPromptResponse(invalidMessage1)).toBe(false);
      expect(isInjectPromptResponse(invalidMessage2)).toBe(false);
    });
  });

  describe('isSyncFullContextMessage', () => {
    it('should return true for valid SyncFullContextMessage', () => {
      const validMessage: SyncFullContextMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'sync-id-123',
        timestamp: Date.now(),
        payload: {
          fileName: 'src/index.ts',
          originalFile: 'original content',
          modifiedFile: 'modified content',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      expect(isSyncFullContextMessage(validMessage)).toBe(true);
    });

    it('should return true for message with empty originalFile (new file)', () => {
      const validMessage: SyncFullContextMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'sync-id-123',
        timestamp: Date.now(),
        payload: {
          fileName: 'src/newfile.ts',
          originalFile: '',
          modifiedFile: 'new file content',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      expect(isSyncFullContextMessage(validMessage)).toBe(true);
    });

    it('should return false for message missing payload fields', () => {
      const invalidMessage1 = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'sync-id-123',
        timestamp: Date.now(),
        payload: {
          // Missing fileName
          originalFile: 'content',
          modifiedFile: 'content',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      const invalidMessage2 = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'sync-id-123',
        timestamp: Date.now(),
        payload: {
          fileName: 'file.ts',
          originalFile: 'content',
          modifiedFile: 'content',
          // Missing isDirty
          timestamp: Date.now(),
        },
      };

      expect(isSyncFullContextMessage(invalidMessage1)).toBe(false);
      expect(isSyncFullContextMessage(invalidMessage2)).toBe(false);
    });

    it('should return false for message with wrong field types', () => {
      const invalidMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'sync-id-123',
        timestamp: Date.now(),
        payload: {
          fileName: 'file.ts',
          originalFile: 'content',
          modifiedFile: 'content',
          isDirty: 'true', // Should be boolean
          timestamp: Date.now(),
        },
      };

      expect(isSyncFullContextMessage(invalidMessage)).toBe(false);
    });
  });

  describe('validateProtocolMessage', () => {
    it('should validate InjectPromptMessage', () => {
      const message: InjectPromptMessage = {
        type: 'INJECT_PROMPT',
        id: 'test-id',
        timestamp: Date.now(),
        payload: {
          prompt: 'Test',
        },
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate InjectPromptResponse', () => {
      const message: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'test-id',
        timestamp: Date.now(),
        originalId: 'original-id',
        payload: {
          success: true,
        },
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate SyncFullContextMessage', () => {
      const message: SyncFullContextMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'test-id',
        timestamp: Date.now(),
        payload: {
          fileName: 'file.ts',
          originalFile: '',
          modifiedFile: 'content',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-object values', () => {
      expect(validateProtocolMessage(null).isValid).toBe(false);
      expect(validateProtocolMessage(undefined).isValid).toBe(false);
      expect(validateProtocolMessage('string').isValid).toBe(false);
      expect(validateProtocolMessage(123).isValid).toBe(false);
    });

    it('should reject message missing id', () => {
      const message = {
        type: 'INJECT_PROMPT',
        timestamp: Date.now(),
        payload: { prompt: 'test' },
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('should reject message missing timestamp', () => {
      const message = {
        type: 'INJECT_PROMPT',
        id: 'test-id',
        payload: { prompt: 'test' },
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    it('should reject message missing type', () => {
      const message = {
        id: 'test-id',
        timestamp: Date.now(),
        payload: { prompt: 'test' },
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject message with unknown type', () => {
      const message = {
        type: 'UNKNOWN_TYPE',
        id: 'test-id',
        timestamp: Date.now(),
      };

      const result = validateProtocolMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown or invalid message type');
    });
  });

  describe('discriminateMessageType', () => {
    it('should discriminate InjectPromptMessage', () => {
      const message: InjectPromptMessage = {
        type: 'INJECT_PROMPT',
        id: 'test-id',
        timestamp: Date.now(),
        payload: {
          prompt: 'Test',
        },
      };

      const result = discriminateMessageType(message);
      expect(result.type).toBe('INJECT_PROMPT');
      expect(result.message).toEqual(message);
    });

    it('should discriminate InjectPromptResponse', () => {
      const message: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'test-id',
        timestamp: Date.now(),
        originalId: 'original-id',
        payload: {
          success: true,
          editorUsed: 'Kiro',
        },
      };

      const result = discriminateMessageType(message);
      expect(result.type).toBe('INJECT_PROMPT_RESPONSE');
      expect(result.message).toEqual(message);
    });

    it('should discriminate SyncFullContextMessage', () => {
      const message: SyncFullContextMessage = {
        type: 'SYNC_FULL_CONTEXT',
        id: 'test-id',
        timestamp: Date.now(),
        payload: {
          fileName: 'file.ts',
          originalFile: '',
          modifiedFile: 'content',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = discriminateMessageType(message);
      expect(result.type).toBe('SYNC_FULL_CONTEXT');
      expect(result.message).toEqual(message);
    });

    it('should return UNKNOWN for unrecognized message types', () => {
      const message = {
        type: 'PING',
        id: 'test-id',
        timestamp: Date.now(),
      } as any;

      const result = discriminateMessageType(message);
      expect(result.type).toBe('UNKNOWN');
      expect(result.message).toEqual(message);
    });

    it('should handle all supported editor names', () => {
      const editors = ['Continue', 'Kiro', 'Cursor', 'Antigravity'];

      editors.forEach((editor) => {
        const message: InjectPromptResponse = {
          type: 'INJECT_PROMPT_RESPONSE',
          id: 'test-id',
          timestamp: Date.now(),
          originalId: 'original-id',
          payload: {
            success: true,
            editorUsed: editor,
          },
        };

        const result = discriminateMessageType(message);
        expect(result.type).toBe('INJECT_PROMPT_RESPONSE');
        if (result.type === 'INJECT_PROMPT_RESPONSE') {
          expect(result.message.payload.editorUsed).toBe(editor);
        }
      });
    });
  });
});
