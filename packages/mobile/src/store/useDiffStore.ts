import { create } from 'zustand';

interface FileState {
  fileName:   string;
  content:    string;
  isDirty:    boolean;
  seq:        number;
  cursorLine: number;
  cursorCol:  number;
}

interface DiffStore {
  file: FileState | null;
  setFile:   (fileName: string, content: string, isDirty: boolean, seq: number) => void;
  setCursor: (line: number, col: number) => void;
  clear:     () => void;
}

export const useDiffStore = create<DiffStore>(set => ({
  file: null,
  setFile: (fileName, content, isDirty, seq) =>
    set(s => ({
      file: {
        fileName, content, isDirty, seq,
        cursorLine: s.file?.cursorLine ?? 0,
        cursorCol:  s.file?.cursorCol  ?? 0,
      },
    })),
  setCursor: (line, col) =>
    set(s => s.file ? { file: { ...s.file, cursorLine: line, cursorCol: col } } : {}),
  clear: () => set({ file: null }),
}));