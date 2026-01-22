import { describe, it, expect, beforeEach, vi } from 'vitest';
import { broadcastToMobileClients, mobileClients } from './index';
import { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';
import { Socket } from 'socket.io';

describe('Relay Server Error Handling', () => {
  beforeEach(() => {
    mobileClients.clear();
    vi.clearAllMocks();
  });

  describe('Broadcast Error Handling', () => {
    it('should handle client emit error gracefully', () => {
      const errorClient = {
        id: 'error-client',
        connected: true,
        emit: vi.fn(() => {
          throw new Error('Socket emit failed');
        }),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'old',
        modifiedFile: 'new',
        isDirty: false,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.add(errorClient);

      // Should not throw, should handle error gracefully
      expect(() => broadcastToMobileClients(message)).not.toThrow();

      // Error client should be removed
      expect(mobileClients.has(errorClient)).toBe(false);
    });

    it('should continue broadcasting to other clients after one fails', () => {
      const errorClient = {
        id: 'error-client',
        connected: true,
        emit: vi.fn(() => {
          throw new Error('Network error');
        }),
      } as unknown as Socket;

      const successClient1 = {
        id: 'success-1',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const successClient2 = {
        id: 'success-2',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/app.ts',
        originalFile: '',
        modifiedFile: 'content',
        isDirty: true,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-456',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.add(errorClient);
      mobileClients.add(successClient1);
      mobileClients.add(successClient2);

      broadcastToMobileClients(message);

      // Success clients should still receive the message
      expect(successClient1.emit).toHaveBeenCalledWith('message', JSON.stringify(message));
      expect(successClient2.emit).toHaveBeenCalledWith('message', JSON.stringify(message));

      // Error client should be removed
      expect(mobileClients.has(errorClient)).toBe(false);
      expect(mobileClients.has(successClient1)).toBe(true);
      expect(mobileClients.has(successClient2)).toBe(true);
    });

    it('should handle multiple client errors', () => {
      const errorClient1 = {
        id: 'error-1',
        connected: true,
        emit: vi.fn(() => {
          throw new Error('Error 1');
        }),
      } as unknown as Socket;

      const errorClient2 = {
        id: 'error-2',
        connected: true,
        emit: vi.fn(() => {
          throw new Error('Error 2');
        }),
      } as unknown as Socket;

      const successClient = {
        id: 'success',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/index.ts',
        originalFile: 'a',
        modifiedFile: 'b',
        isDirty: false,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-789',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.add(errorClient1);
      mobileClients.add(errorClient2);
      mobileClients.add(successClient);

      expect(() => broadcastToMobileClients(message)).not.toThrow();

      // Success client should receive message
      expect(successClient.emit).toHaveBeenCalled();

      // Error clients should be removed
      expect(mobileClients.has(errorClient1)).toBe(false);
      expect(mobileClients.has(errorClient2)).toBe(false);
      expect(mobileClients.has(successClient)).toBe(true);
    });

    it('should handle disconnected clients during broadcast', () => {
      const disconnectedClient = {
        id: 'disconnected',
        connected: false,
        emit: vi.fn(),
      } as unknown as Socket;

      const connectedClient = {
        id: 'connected',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/file.ts',
        originalFile: 'x',
        modifiedFile: 'y',
        isDirty: true,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-disconnect',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.add(disconnectedClient);
      mobileClients.add(connectedClient);

      broadcastToMobileClients(message);

      // Only connected client should receive message
      expect(connectedClient.emit).toHaveBeenCalled();
      expect(disconnectedClient.emit).not.toHaveBeenCalled();

      // Disconnected client should be removed
      expect(mobileClients.has(disconnectedClient)).toBe(false);
      expect(mobileClients.has(connectedClient)).toBe(true);
    });

    it('should handle empty mobile clients set', () => {
      const payload: FileContextPayload = {
        fileName: 'src/empty.ts',
        originalFile: '',
        modifiedFile: '',
        isDirty: false,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-empty',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      // Should not throw with empty set
      expect(() => broadcastToMobileClients(message)).not.toThrow();
    });

    it('should handle JSON serialization errors', () => {
      const client = {
        id: 'client',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      // Create a payload with circular reference (will cause JSON.stringify to fail)
      const circularPayload: any = {
        fileName: 'src/circular.ts',
        originalFile: '',
        modifiedFile: '',
        isDirty: false,
        timestamp: Date.now(),
      };
      circularPayload.self = circularPayload;

      const message: any = {
        id: 'msg-circular',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: circularPayload,
      };

      mobileClients.add(client);

      // Should throw during JSON.stringify, but we test that the function handles it
      expect(() => broadcastToMobileClients(message)).toThrow();
    });
  });
});
