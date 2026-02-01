import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DiffMessageHandler } from './DiffMessageHandler';
import type { SyncFullContextMessage } from '@codelink/protocol';

describe('DiffMessageHandler Property-Based Tests', () => {
  let handler: DiffMessageHandler;

  beforeEach(() => {
    handler = new DiffMessageHandler();
  });

  // Feature: mobile-client-expo-migration, Property 14: SYNC_FULL_CONTEXT Message Parsing
  // Validates: Requirements 7.1
  describe('Property 14: SYNC_FULL_CONTEXT Message Parsing', () => {
    it('should successfully parse any valid SYNC_FULL_CONTEXT message', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('SYNC_FULL_CONTEXT' as const),
            payload: fc.record({
              fileName: fc.string({ minLength: 1, maxLength: 200 }),
              originalFile: fc.string({ maxLength: 1000 }),
              modifiedFile: fc.string({ maxLength: 1000 }),
              isDirty: fc.boolean(),
              timestamp: fc.integer({ min: 0 }),
            }),
          }),
          (message: SyncFullContextMessage) => {
            // Handler should successfully parse the message
            const result = handler.handleMessage(message);
            expect(result).toBe(true);

            // Current diff should be set to the parsed payload
            const currentDiff = handler.getCurrentDiff();
            expect(currentDiff).not.toBeNull();
            expect(currentDiff?.fileName).toBe(message.payload.fileName);
            expect(currentDiff?.originalFile).toBe(message.payload.originalFile);
            expect(currentDiff?.modifiedFile).toBe(message.payload.modifiedFile);
            expect(currentDiff?.isDirty).toBe(message.payload.isDirty);
            expect(currentDiff?.timestamp).toBe(message.payload.timestamp);

            // History should contain the message
            const history = handler.getHistory();
            expect(history.length).toBeGreaterThan(0);
            const lastEntry = history[history.length - 1];
            expect(lastEntry.fileName).toBe(message.payload.fileName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple sequential SYNC_FULL_CONTEXT messages', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constant('SYNC_FULL_CONTEXT' as const),
              payload: fc.record({
                fileName: fc.string({ minLength: 1, maxLength: 200 }),
                originalFile: fc.string({ maxLength: 500 }),
                modifiedFile: fc.string({ maxLength: 500 }),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (messages: SyncFullContextMessage[]) => {
            // Create a fresh handler for each test iteration
            const testHandler = new DiffMessageHandler();
            
            // Process all messages
            messages.forEach(message => {
              const result = testHandler.handleMessage(message);
              expect(result).toBe(true);
            });

            // History should contain all messages
            const history = testHandler.getHistory();
            expect(history.length).toBe(messages.length);

            // Current diff should be the last message
            const currentDiff = testHandler.getCurrentDiff();
            const lastMessage = messages[messages.length - 1];
            expect(currentDiff?.fileName).toBe(lastMessage.payload.fileName);
            expect(currentDiff?.timestamp).toBe(lastMessage.payload.timestamp);

            // Verify all messages are in history in order
            messages.forEach((message, index) => {
              expect(history[index].fileName).toBe(message.payload.fileName);
              expect(history[index].timestamp).toBe(message.payload.timestamp);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle messages with empty file content (new files)', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('SYNC_FULL_CONTEXT' as const),
            payload: fc.record({
              fileName: fc.string({ minLength: 1 }),
              originalFile: fc.constant(''), // Empty for new files
              modifiedFile: fc.string({ minLength: 1 }),
              isDirty: fc.boolean(),
              timestamp: fc.integer({ min: 0 }),
            }),
          }),
          (message: SyncFullContextMessage) => {
            // Should successfully parse even with empty originalFile
            const result = handler.handleMessage(message);
            expect(result).toBe(true);

            const currentDiff = handler.getCurrentDiff();
            expect(currentDiff?.originalFile).toBe('');
            expect(currentDiff?.modifiedFile).toBe(message.payload.modifiedFile);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid message types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Wrong message type
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              type: fc.constantFrom('INJECT_PROMPT', 'INJECT_PROMPT_RESPONSE', 'PING', 'PONG'),
              payload: fc.record({
                fileName: fc.string({ minLength: 1 }),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            }),
            // Not an object
            fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
            // Missing type field
            fc.record({
              id: fc.uuid(),
              timestamp: fc.integer({ min: 0 }),
              payload: fc.record({
                fileName: fc.string({ minLength: 1 }),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
                timestamp: fc.integer({ min: 0 }),
              }),
            })
          ),
          (invalidMessage) => {
            // Should return false for invalid messages
            const result = handler.handleMessage(invalidMessage);
            expect(result).toBe(false);

            // State should not be updated
            const currentDiff = handler.getCurrentDiff();
            expect(currentDiff).toBeNull();
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
                fileName: fc.string({ minLength: 1 }),
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
                fileName: fc.string({ minLength: 1 }),
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
                fileName: fc.string({ minLength: 1 }),
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
                fileName: fc.string({ minLength: 1 }),
                originalFile: fc.string(),
                modifiedFile: fc.string(),
                isDirty: fc.boolean(),
              }),
            })
          ),
          (invalidMessage) => {
            // Should return false for messages with missing fields
            const result = handler.handleMessage(invalidMessage);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle messages with various file path formats', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 0 }),
            type: fc.constant('SYNC_FULL_CONTEXT' as const),
            payload: fc.record({
              fileName: fc.oneof(
                fc.constant('src/index.ts'),
                fc.constant('packages/mobile-client/App.tsx'),
                fc.constant('README.md'),
                fc.constant('path/to/deeply/nested/file.js'),
                fc.constant('file-with-dashes.ts'),
                fc.constant('file_with_underscores.ts'),
                fc.constant('file.test.tsx')
              ),
              originalFile: fc.string(),
              modifiedFile: fc.string(),
              isDirty: fc.boolean(),
              timestamp: fc.integer({ min: 0 }),
            }),
          }),
          (message: SyncFullContextMessage) => {
            // Should successfully parse regardless of file path format
            const result = handler.handleMessage(message);
            expect(result).toBe(true);

            const currentDiff = handler.getCurrentDiff();
            expect(currentDiff?.fileName).toBe(message.payload.fileName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain history limit when receiving many messages', () => {
      const maxHistorySize = 5;
      const limitedHandler = new DiffMessageHandler(maxHistorySize);

      fc.assert(
        fc.property(
          fc.array(
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
            { minLength: maxHistorySize + 1, maxLength: maxHistorySize + 10 }
          ),
          (messages: SyncFullContextMessage[]) => {
            // Process all messages
            messages.forEach(message => {
              limitedHandler.handleMessage(message);
            });

            // History should not exceed max size
            const history = limitedHandler.getHistory();
            expect(history.length).toBeLessThanOrEqual(maxHistorySize);

            // Should contain the most recent messages
            const recentMessages = messages.slice(-maxHistorySize);
            recentMessages.forEach((message, index) => {
              expect(history[index].fileName).toBe(message.payload.fileName);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
