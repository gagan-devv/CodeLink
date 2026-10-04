import { create } from 'zustand';
import { TerminalSessionInfo } from '@codelink/protocol';
import { wsManager } from '../ws/WsManager';
import { secureRandomBytes } from '../crypto/random';
import { MobileE2EESession } from '../crypto/MobileE2EESession';

export type SpecialKey =
  | 'UP'
  | 'DOWN'
  | 'RIGHT'
  | 'LEFT'
  | 'ESC'
  | 'TAB'
  | 'PGUP'
  | 'PGDN'
  | 'CTRL_C'
  | 'CTRL_D'
  | 'CTRL_Z';

export interface MultilinePasteModalState {
  visible: boolean;
  text: string;
  lineCount: number;
}

export interface TerminalStoreState {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  mode: 'observe' | 'control' | 'detached';
  history: Record<string, string>;
  isCtrlActive: boolean;
  isAltActive: boolean;
  hasGap: boolean;
  multilinePasteModal: MultilinePasteModalState;

  // E2EE state
  e2eeState: 'unpaired' | 'initiating' | 'pending_approval' | 'paired' | 'error' | 'failed';
  e2eeSession: MobileE2EESession | null;
  e2eeError: string | null;
  sasCode: string | null;
  sessionToken: string | null;
  deviceId: string | null;

  // Session generation tracking for deduplication & replay protection
  generations: Record<string, number>;
  getGeneration: (sessionId: string) => number;
  incrementGeneration: (sessionId: string) => number;
  setGeneration: (sessionId: string, generation: number) => void;

  setSessions: (sessions: TerminalSessionInfo[]) => void;
  setActiveSession: (id: string) => void;
  setMode: (mode: 'observe' | 'control' | 'detached') => void;
  appendOutput: (sessionId: string, data: string) => void;
  getOutput: (sessionId: string) => string;
  setGapNotice: (hasGap: boolean) => void;
  toggleCtrl: () => void;
  toggleAlt: () => void;
  formatSpecialKey: (key: SpecialKey) => string;
  processKeyInput: (char: string) => string;
  handlePaste: (text: string) => { requiresConfirmation: boolean; text: string };
  confirmPaste: () => string;
  cancelPaste: () => void;
  setPairingState: (
    state: 'unpaired' | 'initiating' | 'pending_approval' | 'paired' | 'error' | 'failed'
  ) => void;
  setPendingApproval: (sessionToken: string, sasCode: string) => void;
  setE2EESession: (session: MobileE2EESession, deviceId: string) => void;
  setE2EEError: (error: string | null) => void;
  clearE2EE: () => void;
  sendEncryptedInput: (
    sessionId: string,
    data: string,
    generation?: number
  ) => { success: boolean; error?: string };
  reset: () => void;
}

const SPECIAL_KEY_MAP: Record<SpecialKey, string> = {
  UP: '\x1b[A',
  DOWN: '\x1b[B',
  RIGHT: '\x1b[C',
  LEFT: '\x1b[D',
  ESC: '\x1b',
  TAB: '\t',
  PGUP: '\x1b[5~',
  PGDN: '\x1b[6~',
  CTRL_C: '\x03',
  CTRL_D: '\x04',
  CTRL_Z: '\x1a',
};

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  mode: 'observe',
  history: {},
  isCtrlActive: false,
  isAltActive: false,
  hasGap: false,
  multilinePasteModal: {
    visible: false,
    text: '',
    lineCount: 0,
  },
  e2eeState: 'unpaired',
  e2eeSession: null,
  e2eeError: null,
  sasCode: null,
  sessionToken: null,
  deviceId: null,

  generations: {},

  getGeneration: (sessionId) => {
    return get().generations[sessionId] ?? 1;
  },

  incrementGeneration: (sessionId) => {
    const current = get().generations[sessionId] ?? 1;
    const next = current + 1;
    set((state) => ({
      generations: {
        ...state.generations,
        [sessionId]: next,
      },
    }));
    return next;
  },

  setGeneration: (sessionId, generation) => {
    set((state) => ({
      generations: {
        ...state.generations,
        [sessionId]: Math.max(1, Math.floor(generation)),
      },
    }));
  },

  setPairingState: (state) => set({ e2eeState: state, e2eeError: null }),

  setPendingApproval: (sessionToken, sasCode) =>
    set({
      e2eeState: 'pending_approval',
      sessionToken,
      sasCode,
      e2eeError: null,
    }),

  setE2EESession: (session, deviceId) =>
    set({
      e2eeSession: session,
      deviceId,
      e2eeState: 'paired',
      e2eeError: null,
      sasCode: null,
      sessionToken: null,
    }),

  setE2EEError: (error) => set({ e2eeError: error, e2eeState: 'error' }),

  clearE2EE: () =>
    set({
      e2eeSession: null,
      deviceId: null,
      e2eeState: 'unpaired',
      e2eeError: null,
      sasCode: null,
      sessionToken: null,
    }),

  sendEncryptedInput: (sessionId, data, generation) => {
    const { e2eeSession, getGeneration } = get();
    if (!e2eeSession) {
      const err = 'Plaintext transmission refused: no active E2EE session exists';
      set({ e2eeError: err, e2eeState: 'error' });
      return { success: false, error: err };
    }

    const effectiveGeneration =
      typeof generation === 'number' && generation >= 1
        ? Math.floor(generation)
        : getGeneration(sessionId);

    try {
      const packet = e2eeSession.encrypt(data);
      const randBytes = secureRandomBytes(4);
      let randHex = '';
      for (let i = 0; i < randBytes.length; i++) {
        randHex += randBytes[i].toString(16).padStart(2, '0');
      }
      const inputId = `in-${Date.now()}-${randHex}`;
      // Send encrypted packet as JSON string payload
      const payload = {
        sessionId,
        inputId,
        generation: effectiveGeneration,
        data: JSON.stringify(packet),
      };
      wsManager.sendTerminal('TERM_INPUT', payload);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ e2eeError: msg, e2eeState: 'error' });
      return { success: false, error: msg };
    }
  },

  setSessions: (sessions) => {
    const currentActive = get().activeSessionId;
    let nextActive = currentActive;
    if (!currentActive && sessions.length > 0) {
      nextActive = sessions[0].id;
    } else if (currentActive && !sessions.some((s) => s.id === currentActive)) {
      nextActive = sessions.length > 0 ? sessions[0].id : null;
    }
    set({ sessions, activeSessionId: nextActive });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  setMode: (mode) => set({ mode }),

  appendOutput: (sessionId, data) => {
    set((state) => {
      const current = state.history[sessionId] || '';
      return {
        history: {
          ...state.history,
          [sessionId]: current + data,
        },
      };
    });
  },

  getOutput: (sessionId) => {
    return get().history[sessionId] || '';
  },

  setGapNotice: (hasGap) => set({ hasGap }),

  toggleCtrl: () => set((state) => ({ isCtrlActive: !state.isCtrlActive })),

  toggleAlt: () => set((state) => ({ isAltActive: !state.isAltActive })),

  formatSpecialKey: (key) => {
    return SPECIAL_KEY_MAP[key] || '';
  },

  processKeyInput: (char) => {
    const { isCtrlActive, isAltActive } = get();

    if (isCtrlActive) {
      set({ isCtrlActive: false });
      const upper = char.toUpperCase();
      const code = upper.charCodeAt(0);
      if (code >= 64 && code <= 95) {
        // Ctrl+A = 1, Ctrl+Z = 26, Ctrl+[ = 27, etc.
        return String.fromCharCode(code - 64);
      }
      return char;
    }

    if (isAltActive) {
      set({ isAltActive: false });
      return '\x1b' + char;
    }

    return char;
  },

  handlePaste: (text) => {
    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    // If more than 1 non-empty line or contains newlines
    if (lines.length > 1 && text.includes('\n')) {
      const lineCount = lines.filter((l) => l.length > 0).length || lines.length;
      set({
        multilinePasteModal: {
          visible: true,
          text,
          lineCount,
        },
      });
      return { requiresConfirmation: true, text };
    }

    return { requiresConfirmation: false, text };
  },

  confirmPaste: () => {
    const text = get().multilinePasteModal.text;
    set({
      multilinePasteModal: {
        visible: false,
        text: '',
        lineCount: 0,
      },
    });
    return text;
  },

  cancelPaste: () => {
    set({
      multilinePasteModal: {
        visible: false,
        text: '',
        lineCount: 0,
      },
    });
  },

  reset: () => {
    set({
      sessions: [],
      activeSessionId: null,
      mode: 'observe',
      history: {},
      isCtrlActive: false,
      isAltActive: false,
      hasGap: false,
      multilinePasteModal: {
        visible: false,
        text: '',
        lineCount: 0,
      },
      e2eeState: 'unpaired',
      e2eeSession: null,
      e2eeError: null,
      sasCode: null,
      sessionToken: null,
      deviceId: null,
      generations: {},
    });
  },
}));
