import { describe, it, expect } from 'vitest';
import { RingBuffer } from './RingBuffer';

describe('RingBuffer', () => {
  it('stores data within capacity and returns tail', () => {
    const buffer = new RingBuffer(1024); // 1 KB capacity
    buffer.write('Hello World');

    const result = buffer.readFrom(0);
    expect(result.hasGap).toBe(false);
    expect(result.data).toBe('Hello World');
    expect(result.nextOffset).toBe(11);
  });

  it('increments byte offset monotonically across multiple writes', () => {
    const buffer = new RingBuffer(1024);
    buffer.write('part1');
    buffer.write('part2');

    expect(buffer.totalBytesWritten).toBe(10);
    const slice = buffer.readFrom(5);
    expect(slice.hasGap).toBe(false);
    expect(slice.data).toBe('part2');
    expect(slice.nextOffset).toBe(10);
  });

  it('drops oldest bytes when exceeding capacity and signals gap', () => {
    // Small buffer of 20 bytes
    const buffer = new RingBuffer(20);

    buffer.write('1234567890'); // offset 0..10
    buffer.write('ABCDEFGHIJ'); // offset 10..20 (buffer now full with 20 bytes)
    buffer.write('KLMNOPQRST'); // offset 20..30 (first 10 bytes overwritten)

    expect(buffer.totalBytesWritten).toBe(30);

    // Request from offset 0, which has been overwritten
    const gapResult = buffer.readFrom(0);
    expect(gapResult.hasGap).toBe(true);
    // Should return whatever is currently retained in the ring
    expect(gapResult.data).toBe('ABCDEFGHIJKLMNOPQRST');
    expect(gapResult.nextOffset).toBe(30);

    // Request from offset 15 (within retained window 10..30)
    const validResult = buffer.readFrom(15);
    expect(validResult.hasGap).toBe(false);
    expect(validResult.data).toBe('FGHIJKLMNOPQRST');
    expect(validResult.nextOffset).toBe(30);
  });
});
