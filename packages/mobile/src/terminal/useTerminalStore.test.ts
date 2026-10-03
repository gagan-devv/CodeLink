import { describe, it, expect, beforeEach } from 'vitest';
import { useTerminalStore } from './useTerminalStore';
import { TerminalSessionInfo } from '@codelink/protocol';

describe('useTerminalStore', () => {
  beforeEach(() => {
    useTerminalStore.getState().reset();
  });

  it('manages sessions and active session tab', () => {
    const sessions: TerminalSessionInfo[] = [
      { id: 'sess-1', title: 'Bash Tab 1', controllerDeviceId: 'dev-1', observerCount: 0, active: true },
      { id: 'sess-2', title: 'Bash Tab 2', controllerDeviceId: null, observerCount: 1, active: true },
    ];

    useTerminalStore.getState().setSessions(sessions);
    expect(useTerminalStore.getState().sessions.length).toBe(2);

    useTerminalStore.getState().setActiveSession('sess-2');
    expect(useTerminalStore.getState().activeSessionId).toBe('sess-2');
  });

  it('manages observe vs control mode', () => {
    useTerminalStore.getState().setMode('control');
    expect(useTerminalStore.getState().mode).toBe('control');

    useTerminalStore.getState().setMode('observe');
    expect(useTerminalStore.getState().mode).toBe('observe');
  });

  it('buffers and appends terminal output per session', () => {
    useTerminalStore.getState().appendOutput('sess-1', 'hello ');
    useTerminalStore.getState().appendOutput('sess-1', 'world\r\n');
    useTerminalStore.getState().appendOutput('sess-2', 'tab 2 output');

    expect(useTerminalStore.getState().getOutput('sess-1')).toBe('hello world\r\n');
    expect(useTerminalStore.getState().getOutput('sess-2')).toBe('tab 2 output');
  });

  it('handles special-keys bar and modifiers (Ctrl, Alt, Esc, Tab, Arrows)', () => {
    const store = useTerminalStore.getState();

    // Arrow keys
    expect(store.formatSpecialKey('UP')).toBe('\x1b[A');
    expect(store.formatSpecialKey('DOWN')).toBe('\x1b[B');
    expect(store.formatSpecialKey('RIGHT')).toBe('\x1b[C');
    expect(store.formatSpecialKey('LEFT')).toBe('\x1b[D');
    expect(store.formatSpecialKey('ESC')).toBe('\x1b');
    expect(store.formatSpecialKey('TAB')).toBe('\t');
    expect(store.formatSpecialKey('PGUP')).toBe('\x1b[5~');
    expect(store.formatSpecialKey('PGDN')).toBe('\x1b[6~');

    // Sticky Ctrl modifier
    store.toggleCtrl();
    expect(useTerminalStore.getState().isCtrlActive).toBe(true);

    // Pressing 'c' with sticky Ctrl -> sends \x03 and deactivates Ctrl
    const ctrlC = useTerminalStore.getState().processKeyInput('c');
    expect(ctrlC).toBe('\x03');
    expect(useTerminalStore.getState().isCtrlActive).toBe(false);

    // Sticky Alt modifier
    store.toggleAlt();
    expect(useTerminalStore.getState().isAltActive).toBe(true);
    const altB = useTerminalStore.getState().processKeyInput('b');
    expect(altB).toBe('\x1bb');
    expect(useTerminalStore.getState().isAltActive).toBe(false);
  });

  it('intercepts multiline paste with confirmation modal', () => {
    const store = useTerminalStore.getState();

    // Single-line text sends directly without modal
    const single = store.handlePaste('echo 123');
    expect(single.requiresConfirmation).toBe(false);
    expect(single.text).toBe('echo 123');
    expect(useTerminalStore.getState().multilinePasteModal.visible).toBe(false);

    // Multiline text triggers modal
    const multilineText = 'sudo apt update\nsudo apt upgrade -y\n';
    const multi = store.handlePaste(multilineText);
    expect(multi.requiresConfirmation).toBe(true);

    const modalState = useTerminalStore.getState().multilinePasteModal;
    expect(modalState.visible).toBe(true);
    expect(modalState.text).toBe(multilineText);
    expect(modalState.lineCount).toBe(2);

    // Canceling paste hides modal and clears text
    store.cancelPaste();
    expect(useTerminalStore.getState().multilinePasteModal.visible).toBe(false);
    expect(useTerminalStore.getState().multilinePasteModal.text).toBe('');

    // Confirming paste returns the text and closes modal
    store.handlePaste(multilineText);
    const confirmed = store.confirmPaste();
    expect(confirmed).toBe(multilineText);
    expect(useTerminalStore.getState().multilinePasteModal.visible).toBe(false);
  });

  it('tracks gap notice when output is dropped', () => {
    expect(useTerminalStore.getState().hasGap).toBe(false);
    useTerminalStore.getState().setGapNotice(true);
    expect(useTerminalStore.getState().hasGap).toBe(true);
    useTerminalStore.getState().setGapNotice(false);
    expect(useTerminalStore.getState().hasGap).toBe(false);
  });
});
