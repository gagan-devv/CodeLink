import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

const { mockLogLine, mockWorkspace, mockWindow } = vi.hoisted(() => {
  const mockLogLine = vi.fn();
  const mockWorkspace = {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }] as any[] | undefined,
    onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  };
  const mockWindow = {
    activeTextEditor: undefined as any,
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
  };
  return { mockLogLine, mockWorkspace, mockWindow };
});

vi.mock('vscode', () => ({
  workspace: mockWorkspace,
  window: mockWindow,
}));

vi.mock('../logger', () => ({
  logLine: (line: string) => mockLogLine(line),
}));

import { FileWatcher } from './FileWatcher';
import { GitIntegrationModule } from '../git/GitIntegrationModule';
import { SnapshotEngine } from './SnapshotEngine';
import { PatchEncoder } from './PatchEncoder';
import { WsClient } from '../websocket/WsClient';

describe('FileWatcher', () => {
  let mockGit: GitIntegrationModule;
  let mockSnapshot: SnapshotEngine;
  let mockPatches: PatchEncoder;
  let mockWs: WsClient;
  let fileWatcher: FileWatcher;

  beforeEach(() => {
    mockLogLine.mockClear();
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockWindow.activeTextEditor = undefined;

    mockGit = {
      initialize: vi.fn().mockResolvedValue(true),
      getHeadVersion: vi.fn().mockResolvedValue(''),
      isTracked: vi.fn().mockResolvedValue(false),
    };

    mockSnapshot = {
      build: vi.fn().mockReturnValue({
        fileName: 'test.ts',
        content: 'const x = 1;',
        encoding: 'utf8',
        seq: 1,
        isDirty: false,
        gitHead: false,
        timestamp: Date.now(),
      }),
      reset: vi.fn(),
    } as unknown as SnapshotEngine;

    mockPatches = {
      encode: vi.fn(),
      recordSnapshot: vi.fn(),
      reset: vi.fn(),
    } as unknown as PatchEncoder;

    mockWs = {
      isConnected: vi.fn().mockReturnValue(true),
      send: vi.fn(),
    } as unknown as WsClient;

    fileWatcher = new FileWatcher(mockGit, mockSnapshot, mockPatches, mockWs);
  });

  describe('getRelativeName', () => {
    it('returns relative path when workspace folder exists', () => {
      mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
      const doc = {
        fileName: '/workspace/src/index.ts',
        uri: { scheme: 'file' },
      } as any;

      expect(fileWatcher.getRelativeName(doc)).toBe('src/index.ts');
    });

    it('falls back to path.basename when no workspace folder is open', () => {
      mockWorkspace.workspaceFolders = undefined;
      const doc = {
        fileName: '/some/external/folder/standalone.ts',
        uri: { scheme: 'file' },
      } as any;

      expect(fileWatcher.getRelativeName(doc)).toBe('standalone.ts');
    });

    it('falls back to path.basename when workspaceFolders is empty array', () => {
      mockWorkspace.workspaceFolders = [];
      const doc = {
        fileName: '/tmp/scratch.js',
        uri: { scheme: 'file' },
      } as any;

      expect(fileWatcher.getRelativeName(doc)).toBe('scratch.js');
    });

    it('returns null if URI scheme is not file', () => {
      mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
      const untitledDoc = {
        fileName: 'Untitled-1',
        uri: { scheme: 'untitled' },
      } as any;

      expect(fileWatcher.getRelativeName(untitledDoc)).toBeNull();

      const outputDoc = {
        fileName: 'extension-output',
        uri: { scheme: 'output' },
      } as any;

      expect(fileWatcher.getRelativeName(outputDoc)).toBeNull();
    });
  });

  describe('resync', () => {
    it('resets activeFile and sends snapshot for active editor', async () => {
      const mockDoc = {
        fileName: '/workspace/src/app.ts',
        uri: { scheme: 'file' },
        getText: vi.fn().mockReturnValue('console.log("hello");'),
        isDirty: false,
      };

      mockWindow.activeTextEditor = {
        document: mockDoc,
        selection: { active: { line: 5, character: 10 } },
      };

      // Initial file switch
      await fileWatcher.onFileSwitch(mockDoc as any);
      expect(mockWs.send).toHaveBeenCalledWith('FILE_SNAPSHOT', expect.anything());
      expect(mockWs.send).toHaveBeenCalledWith('EDITOR_FOCUS', {
        fileName: 'src/app.ts',
        cursorLine: 5,
        cursorCol: 10,
      });

      // Calling onFileSwitch again with same document is deduped
      vi.clearAllMocks();
      await fileWatcher.onFileSwitch(mockDoc as any);
      expect(mockWs.send).not.toHaveBeenCalled();

      // resync resets activeFile and forces sending snapshot again
      await fileWatcher.resync();
      expect(mockWs.send).toHaveBeenCalledWith('FILE_SNAPSHOT', expect.anything());
      expect(mockWs.send).toHaveBeenCalledWith('EDITOR_FOCUS', {
        fileName: 'src/app.ts',
        cursorLine: 5,
        cursorCol: 10,
      });
    });

    it('completes gracefully when activeTextEditor is undefined', async () => {
      mockWindow.activeTextEditor = undefined;
      await expect(fileWatcher.resync()).resolves.toBeUndefined();
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('handleSnapshotRequest', () => {
    it('calls resync when fileName is empty string', async () => {
      const resyncSpy = vi.spyOn(fileWatcher, 'resync');
      await fileWatcher.handleSnapshotRequest('');
      expect(resyncSpy).toHaveBeenCalled();
    });

    it('resets patches and sends snapshot when fileName matches active editor', async () => {
      const mockDoc = {
        fileName: '/workspace/src/app.ts',
        uri: { scheme: 'file' },
        getText: vi.fn().mockReturnValue('export const y = 2;'),
        isDirty: false,
      };

      mockWindow.activeTextEditor = {
        document: mockDoc,
        selection: { active: { line: 0, character: 0 } },
      };

      await fileWatcher.handleSnapshotRequest('src/app.ts');

      expect(mockPatches.reset).toHaveBeenCalledWith('src/app.ts');
      expect(mockSnapshot.reset).toHaveBeenCalledWith('src/app.ts');
      expect(mockWs.send).toHaveBeenCalledWith('FILE_SNAPSHOT', expect.anything());
    });
  });

  describe('diagnostics logging', () => {
    it('logs onFileSwitch and sendSnapshot details', async () => {
      const mockDoc = {
        fileName: '/workspace/src/test.ts',
        uri: { scheme: 'file' },
        getText: vi.fn().mockReturnValue('code'),
        isDirty: true,
      };

      await fileWatcher.onFileSwitch(mockDoc as any);

      expect(mockLogLine).toHaveBeenCalledWith(
        expect.stringContaining('[FileWatcher] onFileSwitch: fileName=src/test.ts')
      );
      expect(mockLogLine).toHaveBeenCalledWith(
        expect.stringContaining('[FileWatcher] sendSnapshot: fileName=src/test.ts')
      );
    });
  });
});
