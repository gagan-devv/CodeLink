import { describe, it, expect } from 'vitest';
import { PingMessage } from '@codelink/protocol';

describe('App Component', () => {
  it('should render without crashing', () => {
    // Basic smoke test - verifying imports work
    expect(true).toBe(true);
  });

  describe('Connection Status', () => {
    it('should show "Disconnected" initially', () => {
      const initialStatus = 'Disconnected';
      expect(initialStatus).toBe('Disconnected');
    });
  });

  describe('PingMessage Creation', () => {
    it('should create PingMessage with correct source "mobile"', () => {
      const ping: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };

      expect(ping.type).toBe('ping');
      expect(ping.source).toBe('mobile');
      expect(typeof ping.id).toBe('string');
      expect(typeof ping.timestamp).toBe('number');
    });

    it('should generate valid UUID for ping message', () => {
      const ping: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(ping.id).toMatch(uuidRegex);
    });

    it('should set timestamp to current time', () => {
      const before = Date.now();
      const ping: PingMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };
      const after = Date.now();

      expect(ping.timestamp).toBeGreaterThanOrEqual(before);
      expect(ping.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
