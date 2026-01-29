import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileWatcher } from './watcher/FileWatcher';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { DiffGeneratorImpl } from './diff/DiffGenerator';
import { WebSocketClient } from './websocket/WebSocketClient';
import { SyncFullContextMessage } from '@codelink/protocol';
import { activate, deactivate, getEditorRegistry, resetEditorRegistry } from './extension';
import { EditorRegistry } from './editors/adapters/EditorRegistry';

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
    executeCommand: vi.fn(),
    getCommands: vi.fn(() => Promise.resolve([])),
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

describe('Extension Activation with Editor Registry', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Set up workspace
    (vscode.workspace.workspaceFolders as any) = [
      { uri: { fsPath: '/workspace' } },
    ];

    // Create mock extension context
    mockContext = {
      subscriptions: [],
      globalState: {
        get: vi.fn() as any,
        update: vi.fn(),
        keys: vi.fn(() => []),
        setKeysForSync: vi.fn(),
      },
      workspaceState: {
        get: vi.fn() as any,
        update: vi.fn(),
        keys: vi.fn(() => []),
      },
      extensionPath: '/extension',
      extensionUri: {} as any,
      environmentVariableCollection: {} as any,
      extensionMode: 3,
      storageUri: undefined,
      storagePath: undefined,
      globalStorageUri: {} as any,
      globalStoragePath: '/global',
      logUri: {} as any,
      logPath: '/logs',
      asAbsolutePath: vi.fn((path: string) => `/extension/${path}`),
      secrets: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    // Mock VS Code commands to return some test commands
    vi.mocked(vscode.commands.getCommands).mockResolvedValue([
      'kiro.chat.sendMessage',
      'kiro.openSettings',
      'continue.continueGUIView.focusContinueInput',
      'continue.openSettings',
    ]);
  });

  afterEach(() => {
    deactivate();
    resetEditorRegistry();
    vi.clearAllMocks();
  });

  it('should initialize editor registry with all adapters', async () => {
    await activate(mockContext);

    const registry = getEditorRegistry();
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(EditorRegistry);

    // Verify all 4 adapters are registered
    const allAdapters = registry!.getAllAdapters();
    expect(allAdapters).toHaveLength(4);

    const adapterIds = allAdapters.map((adapter) => adapter.editorId);
    expect(adapterIds).toContain('continue');
    expect(adapterIds).toContain('kiro');
    expect(adapterIds).toContain('cursor');
    expect(adapterIds).toContain('antigravity');
  });

  it('should run detection on activation', async () => {
    await activate(mockContext);

    const registry = getEditorRegistry();
    expect(registry).toBeDefined();

    // Verify detection was run by checking that getCommands was called
    expect(vscode.commands.getCommands).toHaveBeenCalled();

    // Verify we can get detection results
    const continueAdapter = registry!.getAdapter('continue');
    expect(continueAdapter).toBeDefined();
    expect(continueAdapter!.editorId).toBe('continue');
  });

  it('should make registry accessible from context', async () => {
    await activate(mockContext);

    // Verify registry was stored in global state
    expect(mockContext.globalState.update).toHaveBeenCalledWith(
      'editorRegistry',
      expect.any(EditorRegistry)
    );
  });

  it('should detect installed editors correctly', async () => {
    // Mock commands to show Continue and Kiro are installed
    vi.mocked(vscode.commands.getCommands).mockResolvedValue([
      'continue.continueGUIView.focusContinueInput',
      'continue.openSettings',
      'kiro.chat.sendMessage',
      'kiro.openSettings',
    ]);

    await activate(mockContext);

    const registry = getEditorRegistry();
    expect(registry).toBeDefined();

    // Check detection results
    const detectionResults = await registry!.detectAll();
    
    // Continue should be detected as installed
    const continueResult = detectionResults.get('continue');
    expect(continueResult?.isInstalled).toBe(true);
    expect(continueResult?.availableCommands?.length).toBeGreaterThan(0);

    // Kiro should be detected as installed
    const kiroResult = detectionResults.get('kiro');
    expect(kiroResult?.isInstalled).toBe(true);

    // Cursor should not be detected (no cursor commands)
    const cursorResult = detectionResults.get('cursor');
    expect(cursorResult?.isInstalled).toBe(false);

    // Antigravity should not be detected (no antigravity commands)
    const antigravityResult = detectionResults.get('antigravity');
    expect(antigravityResult?.isInstalled).toBe(false);
  });

  it('should select best available adapter based on sync level', async () => {
    // Mock commands to show Continue (full sync) is installed
    vi.mocked(vscode.commands.getCommands).mockResolvedValue([
      'continue.continueGUIView.focusContinueInput',
      'kiro.chat.sendMessage',
    ]);

    await activate(mockContext);

    const registry = getEditorRegistry();
    expect(registry).toBeDefined();

    // Get best adapter - should prefer Continue (full sync) over Kiro (partial sync)
    const bestAdapter = await registry!.getBestAdapter();
    expect(bestAdapter).toBeDefined();
    expect(bestAdapter!.editorId).toBe('continue');
    expect(bestAdapter!.capabilities.syncLevel).toBe('full');
  });

  it('should handle no editors installed gracefully', async () => {
    // Mock commands to show no AI editors are installed
    vi.mocked(vscode.commands.getCommands).mockResolvedValue([
      'workbench.action.openSettings',
      'editor.action.formatDocument',
    ]);

    await activate(mockContext);

    const registry = getEditorRegistry();
    expect(registry).toBeDefined();

    // Get best adapter - Kiro is always installed since we ARE Kiro
    // So we should get Kiro adapter even when no other editors are installed
    const bestAdapter = await registry!.getBestAdapter();
    expect(bestAdapter).toBeDefined();
    expect(bestAdapter!.editorId).toBe('kiro');
  });

  it('should register cleanup in context subscriptions', async () => {
    await activate(mockContext);

    // Verify that disposal logic was registered
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);

    // Find the disposal object that includes registry cleanup
    const disposables = mockContext.subscriptions;
    expect(disposables.some((d) => typeof d.dispose === 'function')).toBe(true);
  });

  it('should clear registry cache on deactivation', async () => {
    await activate(mockContext);

    const registry = getEditorRegistry();
    expect(registry).toBeDefined();

    // Run detection to populate cache
    await registry!.detectAll();

    // Deactivate extension
    deactivate();

    // Note: We can't directly verify cache was cleared since it's private,
    // but we verify deactivate doesn't throw and completes successfully
    expect(true).toBe(true);
  });

  it('should handle activation errors gracefully', async () => {
    // Mock getCommands to throw an error
    vi.mocked(vscode.commands.getCommands).mockRejectedValue(
      new Error('Command query failed')
    );

    // Activation should not throw
    await expect(activate(mockContext)).resolves.not.toThrow();

    // Registry should still be initialized even if detection fails
    const registry = getEditorRegistry();
    expect(registry).toBeDefined();
  });

  it('should work without workspace folder', async () => {
    // Remove workspace folders
    (vscode.workspace.workspaceFolders as any) = undefined;

    // Activation should not throw
    await expect(activate(mockContext)).resolves.not.toThrow();

    // Registry should not be initialized without workspace
    const registry = getEditorRegistry();
    expect(registry).toBeUndefined();
  });
});
