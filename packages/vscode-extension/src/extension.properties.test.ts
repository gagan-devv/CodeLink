import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';

describe('Extension - Property-Based Tests', () => {
  // Feature: git-integration-diffing, Property 12: Message structure completeness
  it('Property 12: SYNC_FULL_CONTEXT message should include all required fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        fc.integer({ min: 0 }),
        (id, timestamp, fileName, originalFile, modifiedFile, isDirty, payloadTimestamp) => {
          // Create FileContextPayload
          const payload: FileContextPayload = {
            fileName,
            originalFile,
            modifiedFile,
            isDirty,
            timestamp: payloadTimestamp,
          };

          // Create SYNC_FULL_CONTEXT message
          const message: SyncFullContextMessage = {
            id,
            timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };

          // Verify all required fields are present
          expect(message.id).toBeDefined();
          expect(message.timestamp).toBeDefined();
          expect(message.type).toBe('SYNC_FULL_CONTEXT');
          expect(message.payload).toBeDefined();

          // Verify payload fields
          expect(message.payload.fileName).toBeDefined();
          expect(message.payload.originalFile).toBeDefined();
          expect(message.payload.modifiedFile).toBeDefined();
          expect(message.payload.isDirty).toBeDefined();
          expect(message.payload.timestamp).toBeDefined();

          // Verify field types
          expect(typeof message.id).toBe('string');
          expect(typeof message.timestamp).toBe('number');
          expect(typeof message.type).toBe('string');
          expect(typeof message.payload.fileName).toBe('string');
          expect(typeof message.payload.originalFile).toBe('string');
          expect(typeof message.payload.modifiedFile).toBe('string');
          expect(typeof message.payload.isDirty).toBe('boolean');
          expect(typeof message.payload.timestamp).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: FileContextPayload should preserve all field values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        fc.integer({ min: 0 }),
        (fileName, originalFile, modifiedFile, isDirty, timestamp) => {
          const payload: FileContextPayload = {
            fileName,
            originalFile,
            modifiedFile,
            isDirty,
            timestamp,
          };

          // Verify values are preserved exactly
          expect(payload.fileName).toBe(fileName);
          expect(payload.originalFile).toBe(originalFile);
          expect(payload.modifiedFile).toBe(modifiedFile);
          expect(payload.isDirty).toBe(isDirty);
          expect(payload.timestamp).toBe(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Message structure should be serializable to JSON', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        fc.integer({ min: 0 }),
        (id, timestamp, fileName, originalFile, modifiedFile, isDirty, payloadTimestamp) => {
          const payload: FileContextPayload = {
            fileName,
            originalFile,
            modifiedFile,
            isDirty,
            timestamp: payloadTimestamp,
          };

          const message: SyncFullContextMessage = {
            id,
            timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };

          // Serialize to JSON and back
          const json = JSON.stringify(message);
          const parsed = JSON.parse(json);

          // Verify structure is preserved
          expect(parsed.id).toBe(message.id);
          expect(parsed.timestamp).toBe(message.timestamp);
          expect(parsed.type).toBe(message.type);
          expect(parsed.payload.fileName).toBe(message.payload.fileName);
          expect(parsed.payload.originalFile).toBe(message.payload.originalFile);
          expect(parsed.payload.modifiedFile).toBe(message.payload.modifiedFile);
          expect(parsed.payload.isDirty).toBe(message.payload.isDirty);
          expect(parsed.payload.timestamp).toBe(message.payload.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });
});
