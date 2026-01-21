import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { broadcastToMobileClients, mobileClients } from './index';
import { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';
import { Socket } from 'socket.io';

describe('Relay Server - Property-Based Tests', () => {
  beforeEach(() => {
    mobileClients.clear();
  });

  // Feature: git-integration-diffing, Property 14: Message routing
  it('Property 14: should route any SYNC_FULL_CONTEXT message to all connected mobile clients', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        fc.integer({ min: 1, max: 10 }),
        (id, timestamp, fileName, originalFile, modifiedFile, isDirty, numClients) => {
          // Clear clients before each property test
          mobileClients.clear();

          // Create mock clients
          const mockClients: Socket[] = [];
          for (let i = 0; i < numClients; i++) {
            const mockClient = {
              id: `mobile-${i}`,
              connected: true,
              emit: vi.fn(),
            } as unknown as Socket;
            mockClients.push(mockClient);
            mobileClients.add(mockClient);
          }

          // Create a SYNC_FULL_CONTEXT message
          const payload: FileContextPayload = {
            fileName,
            originalFile,
            modifiedFile,
            isDirty,
            timestamp,
          };

          const message: SyncFullContextMessage = {
            id,
            timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };

          // Broadcast the message
          broadcastToMobileClients(message);

          // Verify all clients received the message
          const expectedMessage = JSON.stringify(message);
          mockClients.forEach(client => {
            expect(client.emit).toHaveBeenCalledWith('message', expectedMessage);
            expect(client.emit).toHaveBeenCalledTimes(1);
          });

          // Verify all clients are still in the set
          expect(mobileClients.size).toBe(numClients);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional property: Disconnected clients are removed
  it('Property: should remove any disconnected client from the set', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        (id, timestamp, fileName, originalFile, modifiedFile, isDirty, numClients, numDisconnected) => {
          // Ensure we don't try to disconnect more clients than we have
          const actualDisconnected = Math.min(numDisconnected, numClients - 1);
          
          mobileClients.clear();

          // Create mock clients
          const mockClients: Socket[] = [];
          for (let i = 0; i < numClients; i++) {
            const isDisconnected = i < actualDisconnected;
            const mockClient = {
              id: `mobile-${i}`,
              connected: !isDisconnected,
              emit: vi.fn(),
            } as unknown as Socket;
            mockClients.push(mockClient);
            mobileClients.add(mockClient);
          }

          const payload: FileContextPayload = {
            fileName,
            originalFile,
            modifiedFile,
            isDirty,
            timestamp,
          };

          const message: SyncFullContextMessage = {
            id,
            timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };

          const initialSize = mobileClients.size;
          broadcastToMobileClients(message);

          // Verify disconnected clients were removed
          expect(mobileClients.size).toBe(initialSize - actualDisconnected);

          // Verify only connected clients received the message
          mockClients.forEach((client, index) => {
            if (index < actualDisconnected) {
              expect(client.emit).not.toHaveBeenCalled();
              expect(mobileClients.has(client)).toBe(false);
            } else {
              expect(client.emit).toHaveBeenCalled();
              expect(mobileClients.has(client)).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional property: Error handling doesn't crash
  it('Property: should handle any client error without throwing', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        (id, timestamp, fileName, originalFile, modifiedFile, isDirty, numClients, numErrorClients) => {
          const actualErrorClients = Math.min(numErrorClients, numClients - 1);
          
          mobileClients.clear();

          // Create mock clients
          const mockClients: Socket[] = [];
          for (let i = 0; i < numClients; i++) {
            const shouldError = i < actualErrorClients;
            const mockClient = {
              id: `mobile-${i}`,
              connected: true,
              emit: shouldError ? vi.fn(() => { throw new Error('Network error'); }) : vi.fn(),
            } as unknown as Socket;
            mockClients.push(mockClient);
            mobileClients.add(mockClient);
          }

          const payload: FileContextPayload = {
            fileName,
            originalFile,
            modifiedFile,
            isDirty,
            timestamp,
          };

          const message: SyncFullContextMessage = {
            id,
            timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };

          // Should not throw
          expect(() => broadcastToMobileClients(message)).not.toThrow();

          // Error clients should be removed
          expect(mobileClients.size).toBe(numClients - actualErrorClients);

          // Verify error clients were removed
          mockClients.forEach((client, index) => {
            if (index < actualErrorClients) {
              expect(mobileClients.has(client)).toBe(false);
            } else {
              expect(mobileClients.has(client)).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
