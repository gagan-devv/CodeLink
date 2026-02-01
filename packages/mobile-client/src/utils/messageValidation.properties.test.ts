import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isInjectPromptResponse,
  isSyncFullContextMessage,
  validateProtocolMessage,
} from './messageValidation';
import type {
  InjectPromptResponse,
  SyncFullContextMessage,
} from '@codelink/protocol';

describe('Message Validation Property-Based Tests', () => {
  // Feature: mobile-client-expo-migration, Property 21: Response Message Validation
  // Validates: Requirements 11.3, 11.4
  describe('Property 21: Response Message Validation', () => {
    it('should validate any well-formed InjectPromptResponse message', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('INJECT_PROMPT_RESPONSE' as const),
            originalId: fc.uuid(),
            payload: fc.record({
              success: fc.boolean(),
              error: fc.option(fc.string(), { nil: undefined }),
              editorUsed: fc.option(
                fc.constantFrom('Continue', 'Kiro', 'Cursor', 'Antigravity'),
                { nil: undefined }
              ),
            }),
          }),
          (message) => {
            // Type guard should return true for valid messages
            expect(isInjectPromptResponse(message)).toBe(true);

            // Validate protocol message should also pass
            const validation = validateProtocolMessage(message);
            expect(validation.isValid).toBe(true);
            expect(validation.error).toBeUndefined();

            // Should be able to use as InjectPromptResponse
            if (isInjectPromptResponse(message)) {
              const response: InjectPromptResponse = message;
              expect(response.type).toBe('INJECT_PROMPT_RESPONSE');
              expect(typeof response.id).toBe('string');
              expect(typeof response.timestamp).toBe('number');
              expect(typeof response.originalId).toBe('string');
              expect(typeof response.payload.success).toBe('boolean');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject messages with missing required fields', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Missing id
            fc.record({
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('INJECT_PROMPT_RESPONSE'),
              originalId: fc.uuid(),
              payload: fc.record({ success: fc.boolean() }),
            }),
            // Missing timestamp
            fc.record({
              id: fc.uuid(),
              type: fc.constant('INJECT_PROMPT_RESPONSE'),
              originalId: fc.uuid(),
              payload: fc.record({ success: fc.boolean() }),
            }),
            // Missing originalId
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('INJECT_PROMPT_RESPONSE'),
              payload: fc.record({ success: fc.boolean() }),
            }),
            // Missing payload
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('INJECT_PROMPT_RESPONSE'),
              originalId: fc.uuid(),
            }),
            // Missing success in payload
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('INJECT_PROMPT_RESPONSE'),
              originalId: fc.uuid(),
              payload: fc.record({}),
            })
          ),
          (invalidMessage) => {
            // Type guard should return false
            expect(isInjectPromptResponse(invalidMessage)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate messages with optional fields present or absent', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('INJECT_PROMPT_RESPONSE' as const),
            originalId: fc.uuid(),
            payload: fc.record({
              success: fc.boolean(),
              error: fc.option(fc.string(), { nil: undefined }),
              editorUsed: fc.option(fc.string({ minLength: 1 }), {
                nil: undefined,
              }),
            }),
          }),
          (message) => {
            // Should validate regardless of optional fields
            expect(isInjectPromptResponse(message)).toBe(true);

            // Check optional fields are handled correctly
            if (isInjectPromptResponse(message)) {
              if (message.payload.error !== undefined) {
                expect(typeof message.payload.error).toBe('string');
              }
              if (message.payload.editorUsed !== undefined) {
                expect(typeof message.payload.editorUsed).toBe('string');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: mobile-client-expo-migration, Property 22: SYNC_FULL_CONTEXT Message Validation
  // Validates: Requirements 11.3, 11.4
  describe('Property 22: SYNC_FULL_CONTEXT Message Validation', () => {
    it('should validate any well-formed SyncFullContextMessage', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('SYNC_FULL_CONTEXT' as const),
            payload: fc.record({
              fileName: fc.string({ minLength: 1 }),
              originalFile: fc.string(),
              modifiedFile: fc.string(),
              isDirty: fc.boolean(),
              timestamp: fc.integer({ min: 0 }),
            }),
          }),
          (message) => {
            // Type guard should return true for valid messages
            expect(isSyncFullContextMessage(message)).toBe(true);

            // Validate protocol message should also pass
            const validation = validateProtocolMessage(message);
            expect(validation.isValid).toBe(true);
            expect(validation.error).toBeUndefined();

            // Should be able to use as SyncFullContextMessage
            if (isSyncFullContextMessage(message)) {
              const syncMessage: SyncFullContextMessage = message;
              expect(syncMessage.type).toBe('SYNC_FULL_CONTEXT');
              expect(typeof syncMessage.id).toBe('string');
              expect(typeof syncMessage.timestamp).toBe('number');
              expect(typeof syncMessage.payload.fileName).toBe('string');
              expect(typeof syncMessage.payload.originalFile).toBe('string');
              expect(typeof syncMessage.payload.modifiedFile).toBe('string');
              expect(typeof syncMessage.payload.isDirty).toBe('boolean');
              expect(typeof syncMessage.payload.timestamp).toBe('number');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject messages with missing required payload fields', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Missing fileName
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            // Missing originalFile
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                fileName: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            // Missing modifiedFile
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                fileName: fc.string(),
                originalFile: fc.string(),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            // Missing isDirty
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                fileName: fc.string(),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            // Missing payload timestamp
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                fileName: fc.string(),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
              }),
            })
          ),
          (invalidMessage) => {
            // Type guard should return false
            expect(isSyncFullContextMessage(invalidMessage)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate messages with empty file content strings', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('SYNC_FULL_CONTEXT' as const),
            payload: fc.record({
              fileName: fc.string({ minLength: 1 }),
              originalFile: fc.constant(''), // Empty for new files
              modifiedFile: fc.string(),
              isDirty: fc.boolean(),
              timestamp: fc.integer({ min: 0 }),
            }),
          }),
          (message) => {
            // Should validate even with empty originalFile (new file case)
            expect(isSyncFullContextMessage(message)).toBe(true);

            if (isSyncFullContextMessage(message)) {
              expect(message.payload.originalFile).toBe('');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject messages with wrong field types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Wrong type for fileName (number instead of string)
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                fileName: fc.integer(),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            // Wrong type for isDirty (string instead of boolean)
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT'),
              payload: fc.record({
                fileName: fc.string(),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.string(),
                timestamp: fc.integer({ min: 0 }),
              }),
            })
          ),
          (invalidMessage) => {
            // Type guard should return false for wrong types
            expect(isSyncFullContextMessage(invalidMessage)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
