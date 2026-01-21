import { describe, it, expect } from 'vitest';
import { PingMessage, PongMessage, ProtocolMessage } from './index';

describe('Protocol Types', () => {
  describe('PingMessage', () => {
    it('should create a valid PingMessage with extension source', () => {
      const ping: PingMessage = {
        id: 'test-id-123',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      expect(ping.id).toBe('test-id-123');
      expect(ping.type).toBe('ping');
      expect(ping.source).toBe('extension');
      expect(typeof ping.timestamp).toBe('number');
    });

    it('should create a valid PingMessage with mobile source', () => {
      const ping: PingMessage = {
        id: 'test-id-456',
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };

      expect(ping.id).toBe('test-id-456');
      expect(ping.type).toBe('ping');
      expect(ping.source).toBe('mobile');
      expect(typeof ping.timestamp).toBe('number');
    });
  });

  describe('PongMessage', () => {
    it('should create a valid PongMessage with originalId', () => {
      const pong: PongMessage = {
        id: 'pong-id-789',
        timestamp: Date.now(),
        type: 'pong',
        originalId: 'original-ping-id',
      };

      expect(pong.id).toBe('pong-id-789');
      expect(pong.type).toBe('pong');
      expect(pong.originalId).toBe('original-ping-id');
      expect(typeof pong.timestamp).toBe('number');
    });
  });

  describe('ProtocolMessage union type', () => {
    it('should discriminate PingMessage type', () => {
      const message: ProtocolMessage = {
        id: 'test-id',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      if (message.type === 'ping') {
        expect(message.source).toBeDefined();
        expect(['extension', 'mobile']).toContain(message.source);
      }
    });

    it('should discriminate PongMessage type', () => {
      const message: ProtocolMessage = {
        id: 'test-id',
        timestamp: Date.now(),
        type: 'pong',
        originalId: 'original-id',
      };

      if (message.type === 'pong') {
        expect(message.originalId).toBeDefined();
        expect(message.originalId).toBe('original-id');
      }
    });
  });
});
