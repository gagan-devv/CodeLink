import { create } from 'zustand';

export interface PromptEntry {
  id: string;
  text: string;
  sentAt: number;
  status: 'pending' | 'success' | 'error';
  editorUsed?: string;
  error?: string;
}

interface PromptStore {
  prompts: PromptEntry[];
  addPrompt: (id: string, text: string) => void;
  resolvePrompt: (id: string, success: boolean, editorUsed?: string, error?: string) => void;
  clear: () => void;
}

export const usePromptStore = create<PromptStore>((set) => ({
  prompts: [],
  addPrompt: (id, text) =>
    set((s) => ({
      prompts: [...s.prompts, { id, text, sentAt: Date.now(), status: 'pending' }],
    })),
  resolvePrompt: (id, success, editorUsed, error) =>
    set((s) => ({
      prompts: s.prompts.map((p) =>
        p.id === id ? { ...p, status: success ? 'success' : 'error', editorUsed, error } : p
      ),
    })),
  clear: () => set({ prompts: [] }),
}));
