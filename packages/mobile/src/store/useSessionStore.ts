import { create } from 'zustand';

type Status = 'idle' | 'connecting' | 'connected' | 'revoked';

interface SessionStore {
  status: Status;
  sessionId: string | null;
  setConnecting: () => void;
  setConnected: (sessionId: string) => void;
  setRevoked: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  status: 'idle',
  sessionId: null,
  setConnecting: () => set({ status: 'connecting' }),
  setConnected: (sessionId) => set({ status: 'connected', sessionId }),
  setRevoked: () => set({ status: 'revoked', sessionId: null }),
  reset: () => set({ status: 'idle', sessionId: null }),
}));
