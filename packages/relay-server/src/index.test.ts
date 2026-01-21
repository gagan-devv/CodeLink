import { describe, it, expect } from 'vitest';
import { parseMessage, createPongMessage } from './index';
import { PingMessage } from '@codelink/protocol';

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
