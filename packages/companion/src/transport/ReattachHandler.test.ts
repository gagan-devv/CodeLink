import { describe, it, expect } from 'vitest';
import { ReattachHandler } from './ReattachHandler';
import { RingBuffer } from '../session/RingBuffer';

describe('ReattachHandler', () => {
  it('streams tail slice when client reattaches within ring capacity', () => {
    const ring = new RingBuffer(1024);
    ring.write('line 1\n');
    ring.write('line 2\n');

    const handler = new ReattachHandler(ring);
    const result = handler.handleReattach('sess-1', 7); // from offset 7 ("line 2\n")

    expect(result.hasGap).toBe(false);
    expect(result.data).toBe('line 2\n');
    expect(result.gapNotice).toBeUndefined();
  });

  it('generates explicit gap notice when client reattaches past ring buffer cap', () => {
    // 20-byte ring buffer
    const ring = new RingBuffer(20);
    ring.write('0123456789'); // 0..10
    ring.write('ABCDEFGHIJ'); // 10..20
    ring.write('KLMNOPQRST'); // 20..30 (0..10 dropped)

    const handler = new ReattachHandler(ring);
    // Client asks for offset 5, which fell off
    const result = handler.handleReattach('sess-1', 5);

    expect(result.hasGap).toBe(true);
    expect(result.gapNotice).toBeDefined();
    expect(result.gapNotice?.requestedOffset).toBe(5);
    expect(result.gapNotice?.retainedOffset).toBe(10);
    expect(result.data).toBe('ABCDEFGHIJKLMNOPQRST');
  });

  it('recovers state after simulated relay transport restart', () => {
    const ring = new RingBuffer(1024);
    ring.write('prompt$ ls\nfile1.txt\n');

    const handler = new ReattachHandler(ring);

    // Relay restarts -> client reconnects with offset 11 ("file1.txt\n")
    const recovery = handler.handleReattach('sess-reconnect', 11);
    expect(recovery.hasGap).toBe(false);
    expect(recovery.data).toBe('file1.txt\n');
  });
});
