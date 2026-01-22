import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileWatcher } from './watcher/FileWatcher';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { DiffGeneratorImpl } from './diff/DiffGenerator';
import { WebSocketClient } from './websocket/WebSocketClient';
import { SyncFullContextMessage } from '@codelink/protocol';

// Mock fs/promises module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    onDidChangeActiveTextEditor: vi.fn(),
    activeTextEditor: undefined,
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  workspace: {
    onDidChangeTextDocument: vi.fn(),
    workspaceFolders: [],
    textDocuments: [],
    asRelativePath: vi.fn((path: string) => path.replace('/workspace/', '')),
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

describe('VS Code Extension Integration', () => {
  let fileWatcher: FileWatcher;
  let gitModule: GitIntegrationModuleImpl;
  let diffGenerator: DiffGeneratorImpl;
  let wsClient: WebSocketClient;
  let mockEditorChangeCallback: (editor: vscode.TextEditor | undefined) => void;
  let mockDocumentChangeCallback: (event: vscode.TextDocumentChangeEvent) => void;

  beforeEach(() => {
    // Set up workspace
    (vscode.workspace.workspaceFolders as any) = [
      { uri: { fsPath: '/workspace' } },
    ];

    // Capture VS Code event callbacks
    vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockImplementation((callback) => {
      mockEditorChangeCallback = callback;
      return { dispose: vi.fn() };
    });

    vi.mocked(vscode.workspace.onDidChangeTextDocument).mockImplementation((callback) => {
      mockDocumentChangeCallback = callback;
      return { dispose: vi.fn() };
    });

    // Initialize components
    fileWatcher = new FileWatcher();
    gitModule = new GitIntegrationModuleImpl();
    diffGenerator = new DiffGeneratorImpl();
    wsClient = new WebSocketClient();
  });

  afterEach(() => {
    fileWatcher.dispose();
    wsClient.disconnect();
    vi.clearAllMocks();
  });

  describe('end-to-end pipeline', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should process file change through entire pipeline', async () => {
      // Mock Git module
      vi.spyOn(gitModule, 'getHeadVersion').mockResolvedValue('original content');

      // Mock file system
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('modified content'));
      vi.mocked(mockFs.stat).mockResolvedValue({ size: 100 } as any);

      // Mock WebSocket
      const sendSpy = vi.spyOn(wsClient, 'send');

      // Initialize file watcher with pipeline callback
      fileWatcher.initialize();
      fileWatcher.onFileChanged = async (filePath: string) => {
        const headContent = await gitModule.getHeadVersion(filePath);
        const payload = await diffGenerator.generateDiff(filePath, headContent);
        
        if (payload) {
          const message: SyncFullContextMessage = {
            id: 'test-id',
            timestamp: Date.now(),
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };
          wsClient.send(message);
        }
      };

      // Simulate file change
      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;

      mockEditorChangeCallback(mockEditor);

      // Wait for async operations
      await vi.runAllTimersAsync();

      // Verify message was sent
      expect(sendSpy).toHaveBeenCalled();
      const sentMessage = sendSpy.mock.calls[0][0] as SyncFullContextMessage;
      expect(sentMessage.type).toBe('SYNC_FULL_CONTEXT');
      expect(sentMessage.payload.fileName).toContain('test.ts');
      expect(sentMessage.payload.originalFile).toBe('original content');
      expect(sentMessage.payload.modifiedFile).toBe('modified content');
    });

    it('should handle untracked files correctly', async () => {
      // Mock Git module to return empty string for untracked file
      vi.spyOn(gitModule, 'getHeadVersion').mockResolvedValue('');

      // Mock file system
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('new file content'));
      vi.mocked(mockFs.stat).mockResolvedValue({ size: 100 } as any);

      // Mock WebSocket
      const sendSpy = vi.spyOn(wsClient, 'send');

      // Initialize file watcher with pipeline callback
      fileWatcher.initialize();
      fileWatcher.onFileChanged = async (filePath: string) => {
        const headContent = await gitModule.getHeadVersion(filePath);
        const payload = await diffGenerator.generateDiff(filePath, headContent);
        
        if (payload) {
          const message: SyncFullContextMessage = {
            id: 'test-id',
            timestamp: Date.now(),
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };
          wsClient.send(message);
        }
      };

      // Simulate file change
      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/newfile.ts' },
        },
      } as vscode.TextEditor;

      mockEditorChangeCallback(mockEditor);

      // Wait for async operations
      await vi.runAllTimersAsync();

      // Verify message was sent with empty originalFile
      expect(sendSpy).toHaveBeenCalled();
      const sentMessage = sendSpy.mock.calls[0][0] as SyncFullContextMessage;
      expect(sentMessage.payload.originalFile).toBe('');
      expect(sentMessage.payload.modifiedFile).toBe('new file content');
    });

    it('should handle Git errors gracefully', async () => {
      // Mock Git module to throw error
      vi.spyOn(gitModule, 'getHeadVersion').mockRejectedValue(new Error('Git error'));

      // Mock file system
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('content'));

      // Mock WebSocket
      const sendSpy = vi.spyOn(wsClient, 'send');

      // Initialize file watcher with error handling
      fileWatcher.initialize();
      fileWatcher.onFileChanged = async (filePath: string) => {
        try {
          const headContent = await gitModule.getHeadVersion(filePath);
          const payload = await diffGenerator.generateDiff(filePath, headContent);
          
          if (payload) {
            const message: SyncFullContextMessage = {
              id: 'test-id',
              timestamp: Date.now(),
              type: 'SYNC_FULL_CONTEXT',
              payload,
            };
            wsClient.send(message);
          }
        } catch (error) {
          // Error should be caught and logged
          console.error('Pipeline error:', error);
        }
      };

      // Simulate file change
      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;

      mockEditorChangeCallback(mockEditor);

      // Wait for async operations
      await vi.runAllTimersAsync();

      // Verify no message was sent due to error
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      // Mock Git module
      vi.spyOn(gitModule, 'getHeadVersion').mockResolvedValue('original');

      // Mock file system to throw error
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockRejectedValue(new Error('File read error'));
      vi.mocked(mockFs.stat).mockResolvedValue({ size: 100 } as any);

      // Mock WebSocket
      const sendSpy = vi.spyOn(wsClient, 'send');

      // Initialize file watcher with error handling
      fileWatcher.initialize();
      fileWatcher.onFileChanged = async (filePath: string) => {
        try {
          const headContent = await gitModule.getHeadVersion(filePath);
          const payload = await diffGenerator.generateDiff(filePath, headContent);
          
          if (payload) {
            const message: SyncFullContextMessage = {
              id: 'test-id',
              timestamp: Date.now(),
              type: 'SYNC_FULL_CONTEXT',
              payload,
            };
            wsClient.send(message);
          }
        } catch (error) {
          // Error should be caught
          console.error('Pipeline error:', error);
        }
      };

      // Simulate file change
      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;

      mockEditorChangeCallback(mockEditor);

      // Wait for async operations
      await vi.runAllTimersAsync();

      // Verify no message was sent due to error
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should respect debounce timing', async () => {
      // Mock Git and file system
      vi.spyOn(gitModule, 'getHeadVersion').mockResolvedValue('original');
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('modified'));
      vi.mocked(mockFs.stat).mockResolvedValue({ size: 100 } as any);

      // Mock WebSocket
      const sendSpy = vi.spyOn(wsClient, 'send');

      // Initialize file watcher
      fileWatcher.initialize();
      fileWatcher.onFileChanged = async (filePath: string) => {
        const headContent = await gitModule.getHeadVersion(filePath);
        const payload = await diffGenerator.generateDiff(filePath, headContent);
        
        if (payload) {
          const message: SyncFullContextMessage = {
            id: 'test-id',
            timestamp: Date.now(),
            type: 'SYNC_FULL_CONTEXT',
            payload,
          };
          wsClient.send(message);
        }
      };

      // Simulate editor change first
      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
      } as vscode.TextEditor;
      mockEditorChangeCallback(mockEditor);

      // Wait for first message
      await vi.runAllTimersAsync();
      sendSpy.mockClear();

      // Simulate multiple rapid document changes
      const mockEvent = {
        document: {
          uri: { fsPath: '/workspace/test.ts' },
        },
        contentChanges: [],
        reason: undefined,
      } as unknown as vscode.TextDocumentChangeEvent;

      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(500);
      
      mockDocumentChangeCallback(mockEvent);
      vi.advanceTimersByTime(500);
      
      mockDocumentChangeCallback(mockEvent);

      // Should not have sent yet
      expect(sendSpy).not.toHaveBeenCalled();

      // Advance past debounce period
      await vi.advanceTimersByTimeAsync(1000);

      // Should have sent exactly once
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });
});
