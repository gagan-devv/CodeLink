import { describe, it, expect } from 'vitest';
import { InputDeduplicator } from './InputDeduplicator';

describe('InputDeduplicator', () => {
  it('processes new input IDs and returns isDuplicate: false', () => {
    const dedup = new InputDeduplicator();

    const res1 = dedup.processInput('in-1', 1);
    expect(res1.isDuplicate).toBe(false);
    expect(res1.ack.inputId).toBe('in-1');

    const res2 = dedup.processInput('in-2', 1);
    expect(res2.isDuplicate).toBe(false);
    expect(res2.ack.inputId).toBe('in-2');
  });

  it('rejects duplicate input ID after reconnect within same generation', () => {
    const dedup = new InputDeduplicator();

    const res1 = dedup.processInput('in-repeat', 1);
    expect(res1.isDuplicate).toBe(false);

    // Duplicate input arrives (e.g., client re-transmitted on reconnect)
    const res2 = dedup.processInput('in-repeat', 1);
    expect(res2.isDuplicate).toBe(true);
    // Still returns ACK so client knows host has it
    expect(res2.ack.inputId).toBe('in-repeat');
  });

  it('allows same input ID in a different session generation', () => {
    const dedup = new InputDeduplicator();

    const resGen1 = dedup.processInput('in-same', 1);
    expect(resGen1.isDuplicate).toBe(false);

    // New generation (session generation incremented)
    const resGen2 = dedup.processInput('in-same', 2);
    expect(resGen2.isDuplicate).toBe(false);
  });
});
