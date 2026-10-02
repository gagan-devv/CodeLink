import { describe, it, expect } from 'vitest';
import {
  isTerminalEnvelope,
  isTerminalInputPayload,
  isTerminalResizePayload,
  isTerminalCreditPayload,
  isTerminalModeChangePayload,
  buildTerminalEnvelope,
  MAX_TERMINAL_INPUT_BYTES,
  MAX_TERMINAL_OUTPUT_BYTES,
  TerminalEnvelope,
  TerminalInputPayload,
  TerminalResizePayload,
  TerminalCreditPayload,
  TerminalModeChangePayload,
} from './terminal';

describe('Terminal Protocol Schemas and Type Guards', () => {
  it('identifies a valid terminal envelope', () => {
    const env: TerminalEnvelope<'TERM_INPUT'> = {
      v: 1,
      id: 'msg-123',
      ts: Date.now(),
      type: 'TERM_INPUT',
      payload: {
        sessionId: 'term-sess-1',
        inputId: 'in-1',
        generation: 1,
        data: 'echo hello\n',
      },
    };
    expect(isTerminalEnvelope(env)).toBe(true);
  });

  it('rejects an envelope with unknown terminal message type', () => {
    const env = {
      v: 1,
      id: 'msg-123',
      ts: Date.now(),
      type: 'UNKNOWN_TERM_TYPE',
      payload: {},
    };
    expect(isTerminalEnvelope(env)).toBe(false);
  });

  it('validates TERM_INPUT payload correctly', () => {
    const valid: TerminalInputPayload = {
      sessionId: 'term-1',
      inputId: 'in-1',
      generation: 1,
      data: 'ls -la\n',
    };
    expect(isTerminalInputPayload(valid)).toBe(true);

    // Missing inputId
    expect(isTerminalInputPayload({ sessionId: 'term-1', generation: 1, data: 'ls' })).toBe(false);
    // Negative generation
    expect(
      isTerminalInputPayload({ sessionId: 'term-1', inputId: 'in-1', generation: -1, data: 'ls' })
    ).toBe(false);
    // Non-string data
    expect(
      isTerminalInputPayload({ sessionId: 'term-1', inputId: 'in-1', generation: 1, data: 123 })
    ).toBe(false);
  });

  it('enforces maximum input payload size limit (16 KB)', () => {
    const oversizedData = 'a'.repeat(MAX_TERMINAL_INPUT_BYTES + 1);
    expect(
      isTerminalInputPayload({
        sessionId: 'term-1',
        inputId: 'in-1',
        generation: 1,
        data: oversizedData,
      })
    ).toBe(false);

    const atLimitData = 'a'.repeat(MAX_TERMINAL_INPUT_BYTES);
    expect(
      isTerminalInputPayload({
        sessionId: 'term-1',
        inputId: 'in-1',
        generation: 1,
        data: atLimitData,
      })
    ).toBe(true);
  });

  it('validates TERM_RESIZE payload correctly', () => {
    const valid: TerminalResizePayload = {
      sessionId: 'term-1',
      cols: 120,
      rows: 40,
    };
    expect(isTerminalResizePayload(valid)).toBe(true);

    // Negative or zero dimensions
    expect(isTerminalResizePayload({ sessionId: 'term-1', cols: 0, rows: 24 })).toBe(false);
    expect(isTerminalResizePayload({ sessionId: 'term-1', cols: 80, rows: -5 })).toBe(false);
    // Non-integer dimensions
    expect(isTerminalResizePayload({ sessionId: 'term-1', cols: 80.5, rows: 24 })).toBe(false);
  });

  it('validates TERM_CREDIT payload correctly', () => {
    const valid: TerminalCreditPayload = {
      sessionId: 'term-1',
      bytes: 4096,
    };
    expect(isTerminalCreditPayload(valid)).toBe(true);

    // Negative or zero credits
    expect(isTerminalCreditPayload({ sessionId: 'term-1', bytes: 0 })).toBe(false);
    expect(isTerminalCreditPayload({ sessionId: 'term-1', bytes: -100 })).toBe(false);
  });

  it('validates TERM_MODE_CHANGE payload correctly', () => {
    const validControl: TerminalModeChangePayload = {
      sessionId: 'term-1',
      mode: 'control',
    };
    const validObserve: TerminalModeChangePayload = {
      sessionId: 'term-1',
      mode: 'observe',
    };
    expect(isTerminalModeChangePayload(validControl)).toBe(true);
    expect(isTerminalModeChangePayload(validObserve)).toBe(true);

    expect(isTerminalModeChangePayload({ sessionId: 'term-1', mode: 'root' })).toBe(false);
  });

  it('builds a valid terminal envelope with monotonic sequence and timestamp', () => {
    const env1 = buildTerminalEnvelope('TERM_INPUT', {
      sessionId: 'term-1',
      inputId: 'in-1',
      generation: 1,
      data: 'test',
    });
    const env2 = buildTerminalEnvelope('TERM_RESIZE', {
      sessionId: 'term-1',
      cols: 80,
      rows: 24,
    });

    expect(env1.v).toBe(1);
    expect(env1.type).toBe('TERM_INPUT');
    expect(env1.id).toBeDefined();
    expect(env1.ts).toBeGreaterThan(0);
    expect(env2.seq).toBeGreaterThan(env1.seq);
  });
});
