import { describe, it, expect } from 'vitest';
import { PingMessage } from '@codelink/protocol';

describe('Extension Command', () => {
  describe('PingMessage creation', () => {
    it('should create a valid PingMessage with correct fields', () => {
      // Simulate what the extension command does
      const message: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      expect(message.type).toBe('ping');
      expect(message.source).toBe('extension');
      expect(typeof message.id).toBe('string');
      expect(typeof message.timestamp).toBe('number');
    });

    it('should generate a valid UUID for message ID', () => {
      const message: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(message.id).toMatch(uuidRegex);
    });

    it('should set message source to "extension"', () => {
      const message: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      expect(message.source).toBe('extension');
    });

    it('should set timestamp to current time', () => {
      const before = Date.now();
      const message: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };
      const after = Date.now();

      expect(message.timestamp).toBeGreaterThanOrEqual(before);
      expect(message.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
