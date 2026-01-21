import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileWatcher } from './FileWatcher';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    onDidChangeActiveTextEditor: vi.fn(),
    activeTextEditor: undefined,
  },
  workspace: {
    onDidChangeTextDocument: vi.fn(),
    workspaceFolders: [],
  },
}));

describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;
  let mockEditorChangeCallback: (editor: vscode.TextEditor | undefined) => void;
  let mockDocumentChangeCallback: (event: vscode.TextDocumentChangeEvent) => void;

  beforeEach(() => {
    fileWatcher = new FileWatcher();
    
    vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockImplementation((callback) => {
      mockEditorChangeCallback = callback;
      return { dispose: vi.fn() };
    });
    
    vi.mocked(vscode.workspace.onDidChangeTextDocument).mockImplementation((callback) => {
      mockDocumentChangeCallback = callback;
      return { dispose: vi.fn() };
    });

    (vscode.workspace.workspaceFolders as any) = [
      { uri: { fsPath: '/workspace' } },
    ];
  });

  afterEach(() => {
    fileWatcher.dispose();
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should register event listeners', () => {
      fileWatcher.initialize();

      expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
      expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalled();
    });
  });

  describe('active editor change detection', () => {
    it('should register new active file when editor changes', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/newfile.ts' },
        },
      } as vscode.TextEditor;

      mockEditorChangeCallback(mockEditor);

      expect(onFileChangedSpy).toHaveBeenCalledWith('/workspace/newfile.ts');
    });

    it('should unregister file when editor is closed', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      onFileChangedSpy.mockClear();
      mockEditorChangeCallback(undefined);

      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
        contentChanges: [],
      } as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);

      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });

    it('should not track files outside workspace', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/outside/file.ts' },
        },
      } as vscode.TextEditor;

      mockEditorChangeCallback(mockEditor);

      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });
  });

  describe('text document change detection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger callback after debounce period', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      onFileChangedSpy.mockClear();

      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
        contentChanges: [],
      } as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);

      expect(onFileChangedSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(onFileChangedSpy).toHaveBeenCalledWith('/workspace/test.ts');
    });

    it('should reset debounce timer on multiple rapid changes', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      onFileChangedSpy.mockClear();

      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
        contentChanges: [],
      } as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(500);
      
      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(500);
      
      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(500);

      expect(onFileChangedSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(onFileChangedSpy).toHaveBeenCalledTimes(1);
    });

    it('should only trigger for active file changes', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/active.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      onFileChangedSpy.mockClear();

      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/other.ts' },
        },
        contentChanges: [],
      } as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(1000);

      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });
  });

  describe('workspace file filtering', () => {
    it('should only trigger events for files within workspace', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      expect(onFileChangedSpy).toHaveBeenCalledWith('/workspace/test.ts');

      onFileChangedSpy.mockClear();

      const outsideEditor = {
        document: {
          uri: { fsPath: '/outside/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(outsideEditor);

      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });

    it('should not trigger when no workspace is open', () => {
      (vscode.workspace.workspaceFolders as any) = undefined;

      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clean up listeners', () => {
      const disposeSpy1 = vi.fn();
      const disposeSpy2 = vi.fn();

      vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockReturnValue({
        dispose: disposeSpy1,
      });
      vi.mocked(vscode.workspace.onDidChangeTextDocument).mockReturnValue({
        dispose: disposeSpy2,
      });

      fileWatcher.initialize();
      fileWatcher.dispose();

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });

    it('should clear pending debounce timer', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      onFileChangedSpy.mockClear();

      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
        contentChanges: [],
      } as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);
      fileWatcher.dispose();

      vi.advanceTimersByTime(1000);
      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });
  });

  describe('no events when no file is active', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not trigger events when no file is active', () => {
      fileWatcher.initialize();
      const onFileChangedSpy = vi.fn();
      fileWatcher.onFileChanged = onFileChangedSpy;

      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
        contentChanges: [],
      } as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(1000);

      expect(onFileChangedSpy).not.toHaveBeenCalled();
    });
  });
});
