import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { handleMessage } from './MessageDispatcher';
import { useTerminalStore } from '../terminal/useTerminalStore';

describe('MessageDispatcher Terminal Gap & Generation', () => {
  beforeEach(() => {
    useTerminalStore.getState().reset();
  });

  it('increments generation exactly once when TERM_ATTACH_RESP (hasGap) is followed by TERM_GAP', () => {
    const sessionId = 'test-session-1';
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(1);
    expect(useTerminalStore.getState().hasGap).toBe(false);

    // Relay sends TERM_ATTACH_RESP with hasGap: true
    handleMessage(
      'TERM_ATTACH_RESP',
      { sessionId, mode: 'control', hasGap: true },
      'msg-1'
    );

    // Mode is updated, gap notice is set, but generation is NOT incremented yet
    expect(useTerminalStore.getState().mode).toBe('control');
    expect(useTerminalStore.getState().hasGap).toBe(true);
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(1);

    // Relay sends subsequent TERM_GAP
    handleMessage(
      'TERM_GAP',
      { sessionId, expectedOffset: 100, receivedOffset: 0 },
      'msg-2'
    );

    // Generation must now be incremented exactly once (1 -> 2, not 3)
    expect(useTerminalStore.getState().hasGap).toBe(true);
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(2);
  });

  it('does not increment generation or set gap notice on TERM_ATTACH_RESP with hasGap: false', () => {
    const sessionId = 'test-session-2';
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(1);

    handleMessage(
      'TERM_ATTACH_RESP',
      { sessionId, mode: 'observe', hasGap: false },
      'msg-3'
    );

    expect(useTerminalStore.getState().mode).toBe('observe');
    expect(useTerminalStore.getState().hasGap).toBe(false);
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(1);
  });

  it('increments generation when standalone TERM_GAP is received', () => {
    const sessionId = 'test-session-3';
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(1);

    handleMessage(
      'TERM_GAP',
      { sessionId, expectedOffset: 250, receivedOffset: 150 },
      'msg-4'
    );

    expect(useTerminalStore.getState().hasGap).toBe(true);
    expect(useTerminalStore.getState().getGeneration(sessionId)).toBe(2);
  });
});
