import { describe, it, expect } from 'vitest';
import { FlowController } from './FlowController';

describe('FlowController (Credits, Backpressure, Priority Control)', () => {
  it('manages byte credit window and triggers pause on exhaustion', () => {
    // 1000 bytes initial credits, low watermark 200 bytes
    const fc = new FlowController({ initialCredits: 1000, lowWatermark: 200 });

    expect(fc.canSend(500)).toBe(true);
    fc.consume(500);
    expect(fc.remainingCredits).toBe(500);
    expect(fc.isPaused()).toBe(false);

    // Consuming past low watermark triggers pause
    fc.consume(400);
    expect(fc.remainingCredits).toBe(100);
    expect(fc.isPaused()).toBe(true);
  });

  it('resumes streaming when client returns byte credits', () => {
    const fc = new FlowController({ initialCredits: 500, lowWatermark: 100 });
    fc.consume(450);
    expect(fc.isPaused()).toBe(true);

    // Client parses output in xterm.js and returns 400 byte credits
    fc.replenish(400);
    expect(fc.remainingCredits).toBe(450);
    expect(fc.isPaused()).toBe(false);
  });

  it('prioritizes Ctrl+C and control messages over queued bulk output', () => {
    const fc = new FlowController({ initialCredits: 100 });
    fc.consume(100); // pause bulk output

    // Bulk output queued
    fc.enqueueOutput('bulk data chunk 1');
    fc.enqueueOutput('bulk data chunk 2');

    // Urgent Ctrl+C arrives
    fc.enqueuePriorityControl('\x03'); // Ctrl+C

    // The next message to send must be the priority control message!
    const nextMsg = fc.dequeue();
    expect(nextMsg).toEqual({ type: 'control', data: '\x03' });

    // Subsequent messages are bulk output
    const bulk1 = fc.dequeue();
    expect(bulk1).toEqual({ type: 'bulk', data: 'bulk data chunk 1' });
  });

  it('drains and resets queue when client disconnects while paused', () => {
    const fc = new FlowController({ initialCredits: 500 });
    fc.consume(500);
    fc.enqueueOutput('pending chunk 1');
    fc.enqueueOutput('pending chunk 2');
    expect(fc.isPaused()).toBe(true);

    fc.reset();
    expect(fc.isPaused()).toBe(false);
    expect(fc.dequeue()).toBeNull();
  });
});
