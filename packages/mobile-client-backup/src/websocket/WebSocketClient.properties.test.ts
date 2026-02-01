import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { WebSocketClient } from './WebSocketClient';
import { FileContextPayload, SyncFullContextMessage } from '@codelink/protocol';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

describe('WebSocketClient - Property-Based Tests', () => {
  let mockSocket: any;
  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    eventHandlers = {};
    
    mockSocket = {
      on: vi.fn((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
      close: vi.fn(),
    };

    (io as any).mockReturnValue(mockSocket);
  });

  // Arbitrary generators for FileContextPayload
  const fileNameArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
  const fileContentArbitrary = fc.string({ maxLength: 1000 });
  const timestampArbitrary = fc.integer({ min: 0, max: Date.now() + 1000000 });

  const fileContextPayloadArbitrary = fc.record({
    fileName: fileNameArbitrary,
    originalFile: fileContentArbitrary,
    modifiedFile: fileContentArbitrary,
    isDirty: fc.boolean(),
    timestamp: timestampArbitrary,
  });

  // Feature: git-integration-diffing, Property 16: Message parsing
  describe('Property 16: Message parsing', () => {
    it('should parse any valid SYNC_FULL_CONTEXT message', () => {
      fc.assert(
        fc.property(fileContextPayloadArbitrary, fc.string(), timestampArbitrary, (payload, id, timestamp) => {
          const client = new WebSocketClient({ url: 'http://localhost:8080' });
          const payloadCallback = vi.fn();
          client.onPayload(payloadCallback);
          client.connect();

          const message: SyncFullContextMessage = {
            id,
            type: 'SYNC_FULL_CONTEXT',
            payload,
            timestamp,
          };

          eventHandlers['message'](JSON.stringify(message));

          expect(payloadCallback).toHaveBeenCalledWith(payload);
          expect(payloadCallback).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly extract all fields from any valid payload', () => {
      fc.assert(
        fc.property(fileContextPayloadArbitrary, (payload) => {
          const client = new WebSocketClient({ url: 'http://localhost:8080' });
          const payloadCallback = vi.fn();
          client.onPayload(payloadCallback);
          client.connect();

          const message: SyncFullContextMessage = {
            id: 'test-id',
            type: 'SYNC_FULL_CONTEXT',
            payload,
            timestamp: Date.now(),
          };

          eventHandlers['message'](JSON.stringify(message));

          const receivedPayload = payloadCallback.mock.calls[0][0];
          expect(receivedPayload.fileName).toBe(payload.fileName);
          expect(receivedPayload.originalFile).toBe(payload.originalFile);
          expect(receivedPayload.modifiedFile).toBe(payload.modifiedFile);
          expect(receivedPayload.isDirty).toBe(payload.isDirty);
          expect(receivedPayload.timestamp).toBe(payload.timestamp);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle payloads with empty file content', () => {
      fc.assert(
        fc.property(fileNameArbitrary, fc.boolean(), timestampArbitrary, (fileName, isDirty, timestamp) => {
          const client = new WebSocketClient({ url: 'http://localhost:8080' });
          const payloadCallback = vi.fn();
          client.onPayload(payloadCallback);
          client.connect();

          const payload: FileContextPayload = {
            fileName,
            originalFile: '',
            modifiedFile: '',
            isDirty,
            timestamp,
          };

          const message: SyncFullContextMessage = {
            id: 'test-id',
            type: 'SYNC_FULL_CONTEXT',
            payload,
            timestamp: Date.now(),
          };

          eventHandlers['message'](JSON.stringify(message));

          expect(payloadCallback).toHaveBeenCalledWith(payload);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle payloads with large file content', () => {
      fc.assert(
        fc.property(
          fileNameArbitrary,
          fc.string({ minLength: 5000, maxLength: 10000 }),
          fc.string({ minLength: 5000, maxLength: 10000 }),
          fc.boolean(),
          timestampArbitrary,
          (fileName, originalFile, modifiedFile, isDirty, timestamp) => {
            const client = new WebSocketClient({ url: 'http://localhost:8080' });
            const payloadCallback = vi.fn();
            client.onPayload(payloadCallback);
            client.connect();

            const payload: FileContextPayload = {
              fileName,
              originalFile,
              modifiedFile,
              isDirty,
              timestamp,
            };

            const message: SyncFullContextMessage = {
              id: 'test-id',
              type: 'SYNC_FULL_CONTEXT',
              payload,
              timestamp: Date.now(),
            };

            eventHandlers['message'](JSON.stringify(message));

            const receivedPayload = payloadCallback.mock.calls[0][0];
            expect(receivedPayload.originalFile.length).toBe(originalFile.length);
            expect(receivedPayload.modifiedFile.length).toBe(modifiedFile.length);
          }
        ),
        { numRuns: 50 } // Fewer runs for large content
      );
    });
  });

  // Feature: git-integration-diffing, Property 18: Malformed message handling
  describe('Property 18: Malformed message handling', () => {
    it('should not crash on any malformed JSON string', () => {
      fc.assert(
        fc.property(fc.string(), (malformedJson) => {
          const client = new WebSocketClient({ url: 'http://localhost:8080' });
          const payloadCallback = vi.fn();
          client.onPayload(payloadCallback);
          client.connect();

          // Should not throw
          expect(() => {
            eventHandlers['message'](malformedJson);
          }).not.toThrow();

          // Should not invoke callback for malformed messages
          expect(payloadCallback).not.toHaveBeenCalled();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject messages with missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            fileName: fc.option(fileNameArbitrary, { nil: undefined }),
            originalFile: fc.option(fileContentArbitrary, { nil: undefined }),
            modifiedFile: fc.option(fileContentArbitrary, { nil: undefined }),
            isDirty: fc.option(fc.boolean(), { nil: undefined }),
            timestamp: fc.option(timestampArbitrary, { nil: undefined }),
          }),
          (partialPayload) => {
            // Skip if all fields are present (valid case)
            const hasAllFields = 
              partialPayload.fileName !== undefined &&
              partialPayload.originalFile !== undefined &&
              partialPayload.modifiedFile !== undefined &&
              partialPayload.isDirty !== undefined &&
              partialPayload.timestamp !== undefined;

            if (hasAllFields) {
              return true; // Skip this case
            }

            const client = new WebSocketClient({ url: 'http://localhost:8080' });
            const payloadCallback = vi.fn();
            client.onPayload(payloadCallback);
            client.connect();

            const message = {
              id: 'test-id',
              type: 'SYNC_FULL_CONTEXT',
              payload: partialPayload,
              timestamp: Date.now(),
            };

            eventHandlers['message'](JSON.stringify(message));

            // Should not invoke callback for invalid payload
            expect(payloadCallback).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject messages with incorrect field types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // fileName as number
            fc.record({
              fileName: fc.integer(),
              originalFile: fileContentArbitrary,
              modifiedFile: fileContentArbitrary,
              isDirty: fc.boolean(),
              timestamp: timestampArbitrary,
            }),
            // isDirty as string
            fc.record({
              fileName: fileNameArbitrary,
              originalFile: fileContentArbitrary,
              modifiedFile: fileContentArbitrary,
              isDirty: fc.string(),
              timestamp: timestampArbitrary,
            }),
            // timestamp as string
            fc.record({
              fileName: fileNameArbitrary,
              originalFile: fileContentArbitrary,
              modifiedFile: fileContentArbitrary,
              isDirty: fc.boolean(),
              timestamp: fc.string(),
            })
          ),
          (invalidPayload) => {
            const client = new WebSocketClient({ url: 'http://localhost:8080' });
            const payloadCallback = vi.fn();
            client.onPayload(payloadCallback);
            client.connect();

            const message = {
              id: 'test-id',
              type: 'SYNC_FULL_CONTEXT',
              payload: invalidPayload,
              timestamp: Date.now(),
            };

            eventHandlers['message'](JSON.stringify(message));

            // Should not invoke callback for invalid types
            expect(payloadCallback).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue operation after any malformed message', () => {
      fc.assert(
        fc.property(fc.string(), fileContextPayloadArbitrary, (malformedJson, validPayload) => {
          const client = new WebSocketClient({ url: 'http://localhost:8080' });
          const payloadCallback = vi.fn();
          client.onPayload(payloadCallback);
          client.connect();

          // Send malformed message
          eventHandlers['message'](malformedJson);

          // Send valid message
          const validMessage: SyncFullContextMessage = {
            id: 'test-id',
            type: 'SYNC_FULL_CONTEXT',
            payload: validPayload,
            timestamp: Date.now(),
          };

          eventHandlers['message'](JSON.stringify(validMessage));

          // Should have received the valid payload
          expect(payloadCallback).toHaveBeenCalledWith(validPayload);
          expect(payloadCallback).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle messages with extra unexpected fields', () => {
      fc.assert(
        fc.property(
          fileContextPayloadArbitrary,
          fc.record({
            extraField1: fc.string(),
            extraField2: fc.integer(),
            extraField3: fc.boolean(),
          }),
          (payload, extraFields) => {
            const client = new WebSocketClient({ url: 'http://localhost:8080' });
            const payloadCallback = vi.fn();
            client.onPayload(payloadCallback);
            client.connect();

            const message = {
              id: 'test-id',
              type: 'SYNC_FULL_CONTEXT',
              payload: { ...payload, ...extraFields },
              timestamp: Date.now(),
            };

            eventHandlers['message'](JSON.stringify(message));

            // Should still parse successfully (extra fields are ignored)
            expect(payloadCallback).toHaveBeenCalled();
            const receivedPayload = payloadCallback.mock.calls[0][0];
            expect(receivedPayload.fileName).toBe(payload.fileName);
            expect(receivedPayload.originalFile).toBe(payload.originalFile);
            expect(receivedPayload.modifiedFile).toBe(payload.modifiedFile);
            expect(receivedPayload.isDirty).toBe(payload.isDirty);
            expect(receivedPayload.timestamp).toBe(payload.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
