import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
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

describe('FileWatcher - Property-Based Tests', () => {
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

    fileWatcher.initialize();
  });

  afterEach(() => {
    fileWatcher.dispose();
    vi.clearAllMocks();
  });

  // Feature: git-integration-diffing, Property 1: Active file tracking
  it('Property 1: should track any file that becomes the active editor', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(s => `/workspace/${s}.ts`),
        (filePath) => {
          const onFileChangedSpy = vi.fn();
          fileWatcher.onFileChanged = onFileChangedSpy;

          const mockEditor = {
            document: {
              uri: { fsPath: filePath },
            },
          } as vscode.TextEditor;

          mockEditorChangeCallback(mockEditor);

          expect(onFileChangedSpy).toHaveBeenCalledWith(filePath);
          onFileChangedSpy.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: git-integration-diffing, Property 2: Debounce timing
  it('Property 2: should not trigger callback until 1000ms after last change', () => {
    vi.useFakeTimers();

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(s => `/workspace/${s}.ts`),
        fc.integer({ min: 2, max: 10 }),
        (filePath, numChanges) => {
          const onFileChangedSpy = vi.fn();
          fileWatcher.onFileChanged = onFileChangedSpy;

          const mockEditor = {
            document: {
              uri: { fsPath: filePath },
            },
          } as vscode.TextEditor;
          mockEditorChangeCallback(mockEditor);

          onFileChangedSpy.mockClear();

          const mockEvent = {
            document: {
              uri: { fsPath: filePath },
            },
            contentChanges: [],
          } as vscode.TextDocumentChangeEvent;

          for (let i = 0; i < numChanges; i++) {
            mockDocumentChangeCallback(mockEvent);
            vi.advanceTimersByTime(500);
            expect(onFileChangedSpy).not.toHaveBeenCalled();
          }

          vi.advanceTimersByTime(500);
          expect(onFileChangedSpy).toHaveBeenCalledTimes(1);
          expect(onFileChangedSpy).toHaveBeenCalledWith(filePath);

          onFileChangedSpy.mockClear();
        }
      ),
      { numRuns: 100 }
    );

    vi.useRealTimers();
  });

  // Feature: git-integration-diffing, Property 3: Editor cleanup
  it('Property 3: should stop tracking file when editor is closed', () => {
    vi.useFakeTimers();

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(s => `/workspace/${s}.ts`),
        (filePath) => {
          const onFileChangedSpy = vi.fn();
          fileWatcher.onFileChanged = onFileChangedSpy;

          const mockEditor = {
            document: {
              uri: { fsPath: filePath },
            },
          } as vscode.TextEditor;
          mockEditorChangeCallback(mockEditor);

          onFileChangedSpy.mockClear();

          mockEditorChangeCallback(undefined);

          const mockEvent = {
            document: {
              uri: { fsPath: filePath },
            },
            contentChanges: [],
          } as vscode.TextDocumentChangeEvent;

          mockDocumentChangeCallback(mockEvent);
          vi.advanceTimersByTime(1000);

          expect(onFileChangedSpy).not.toHaveBeenCalled();

          onFileChangedSpy.mockClear();
        }
      ),
      { numRuns: 100 }
    );

    vi.useRealTimers();
  });
});
