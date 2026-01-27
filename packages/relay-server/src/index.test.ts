import { describe, it, expect, vi } from 'vitest';
import { parseMessage, createPongMessage, broadcastToMobileClients, mobileClients } from './index';
import { PingMessage, SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';
import { Socket } from 'socket.io';

describe('Message Parsing', () => {
  describe('parseMessage', () => {
    it('should parse valid PingMessage JSON correctly', () => {
      const validPing = {
        id: 'test-id-123',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      const jsonString = JSON.stringify(validPing);
      const parsed = parseMessage(jsonString);

      expect(parsed.id).toBe('test-id-123');
      expect(parsed.type).toBe('ping');
      expect(parsed.timestamp).toBe(validPing.timestamp);
      if (parsed.type === 'ping') {
        expect(parsed.source).toBe('extension');
      }
    });

    it('should parse valid PingMessage with mobile source', () => {
      const validPing = {
        id: 'mobile-id-456',
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };

      const jsonString = JSON.stringify(validPing);
      const parsed = parseMessage(jsonString);

      expect(parsed.id).toBe('mobile-id-456');
      expect(parsed.type).toBe('ping');
      if (parsed.type === 'ping') {
        expect(parsed.source).toBe('mobile');
      }
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = 'not valid json {';

      expect(() => parseMessage(invalidJson)).toThrow();
    });

    it('should throw error for message missing required fields', () => {
      const missingId = JSON.stringify({
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      });

      expect(() => parseMessage(missingId)).toThrow(
        'Invalid message format: missing required fields'
      );
    });

    it('should throw error for message missing type field', () => {
      const missingType = JSON.stringify({
        id: 'test-id',
        timestamp: Date.now(),
        source: 'extension',
      });

      expect(() => parseMessage(missingType)).toThrow(
        'Invalid message format: missing required fields'
      );
    });

    it('should throw error for message missing timestamp field', () => {
      const missingTimestamp = JSON.stringify({
        id: 'test-id',
        type: 'ping',
        source: 'extension',
      });

      expect(() => parseMessage(missingTimestamp)).toThrow(
        'Invalid message format: missing required fields'
      );
    });
  });

  describe('createPongMessage', () => {
    it('should create PongMessage from PingMessage', () => {
      const ping: PingMessage = {
        id: 'ping-id-789',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      const pong = createPongMessage(ping);

      expect(pong.type).toBe('pong');
      expect(pong.originalId).toBe('ping-id-789');
      expect(typeof pong.id).toBe('string');
      expect(pong.id).not.toBe(ping.id);
      expect(typeof pong.timestamp).toBe('number');
    });

    it('should generate unique ID for PongMessage', () => {
      const ping: PingMessage = {
        id: 'ping-id-unique',
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };

      const pong1 = createPongMessage(ping);
      const pong2 = createPongMessage(ping);

      expect(pong1.id).not.toBe(pong2.id);
      expect(pong1.originalId).toBe(ping.id);
      expect(pong2.originalId).toBe(ping.id);
    });

    it('should set current timestamp for PongMessage', () => {
      const ping: PingMessage = {
        id: 'ping-id',
        timestamp: Date.now() - 1000, // 1 second ago
        type: 'ping',
        source: 'extension',
      };

      const before = Date.now();
      const pong = createPongMessage(ping);
      const after = Date.now();

      expect(pong.timestamp).toBeGreaterThanOrEqual(before);
      expect(pong.timestamp).toBeLessThanOrEqual(after);
      expect(pong.timestamp).toBeGreaterThan(ping.timestamp);
    });
  });
});

describe('Relay Server Routing', () => {
  describe('broadcastToMobileClients', () => {
    it('should route SYNC_FULL_CONTEXT messages correctly', () => {
      // Create mock mobile clients
      const mockClient1 = {
        id: 'mobile-1',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const mockClient2 = {
        id: 'mobile-2',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      // Create a SYNC_FULL_CONTEXT message
      const payload: FileContextPayload = {
        fileName: 'src/test.ts',
        originalFile: 'original content',
        modifiedFile: 'modified content',
        isDirty: true,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      // Manually add clients to the mobileClients set
      mobileClients.clear();
      mobileClients.add(mockClient1);
      mobileClients.add(mockClient2);

      // Broadcast the message
      broadcastToMobileClients(message);

      // Verify both clients received the message
      expect(mockClient1.emit).toHaveBeenCalledWith('message', JSON.stringify(message));
      expect(mockClient2.emit).toHaveBeenCalledWith('message', JSON.stringify(message));
      expect(mockClient1.emit).toHaveBeenCalledTimes(1);
      expect(mockClient2.emit).toHaveBeenCalledTimes(1);
    });

    it('should broadcast to all connected mobile clients', () => {
      const mockClient1 = {
        id: 'mobile-1',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const mockClient2 = {
        id: 'mobile-2',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const mockClient3 = {
        id: 'mobile-3',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/app.ts',
        originalFile: '',
        modifiedFile: 'new file content',
        isDirty: false,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-456',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.clear();
      mobileClients.add(mockClient1);
      mobileClients.add(mockClient2);
      mobileClients.add(mockClient3);

      broadcastToMobileClients(message);

      expect(mockClient1.emit).toHaveBeenCalled();
      expect(mockClient2.emit).toHaveBeenCalled();
      expect(mockClient3.emit).toHaveBeenCalled();
    });

    it('should skip disconnected clients', () => {
      const connectedClient = {
        id: 'mobile-connected',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const disconnectedClient = {
        id: 'mobile-disconnected',
        connected: false,
        emit: vi.fn(),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/index.ts',
        originalFile: 'old',
        modifiedFile: 'new',
        isDirty: true,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-789',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.clear();
      mobileClients.add(connectedClient);
      mobileClients.add(disconnectedClient);

      broadcastToMobileClients(message);

      // Only connected client should receive the message
      expect(connectedClient.emit).toHaveBeenCalledWith('message', JSON.stringify(message));
      expect(disconnectedClient.emit).not.toHaveBeenCalled();

      // Disconnected client should be removed from the set
      expect(mobileClients.has(disconnectedClient)).toBe(false);
      expect(mobileClients.has(connectedClient)).toBe(true);
    });

    it('should handle errors during broadcast', () => {
      const workingClient = {
        id: 'mobile-working',
        connected: true,
        emit: vi.fn(),
      } as unknown as Socket;

      const errorClient = {
        id: 'mobile-error',
        connected: true,
        emit: vi.fn(() => {
          throw new Error('Network error');
        }),
      } as unknown as Socket;

      const payload: FileContextPayload = {
        fileName: 'src/error.ts',
        originalFile: 'content',
        modifiedFile: 'content',
        isDirty: false,
        timestamp: Date.now(),
      };

      const message: SyncFullContextMessage = {
        id: 'msg-error',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload,
      };

      mobileClients.clear();
      mobileClients.add(workingClient);
      mobileClients.add(errorClient);

      // Should not throw, should handle error gracefully
      expect(() => broadcastToMobileClients(message)).not.toThrow();

      // Working client should still receive the message
      expect(workingClient.emit).toHaveBeenCalled();

      // Error client should be removed from the set
      expect(mobileClients.has(errorClient)).toBe(false);
      expect(mobileClients.has(workingClient)).toBe(true);
    });
  });
});
