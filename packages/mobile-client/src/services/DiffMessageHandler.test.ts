import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffMessageHandler } from './DiffMessageHandler';
import type { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';

describe('DiffMessageHandler Unit Tests', () => {
  let handler: DiffMessageHandler;

  beforeEach(() => {
    handler = new DiffMessageHandler();
  });

  describe('Parsing Valid Messages', () => {
    it('should parse a valid SYNC_FULL_CONTEXT message', () => {
      const message: SyncFullContextMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'src/index.ts',
          originalFile: 'const x = 1;',
          modifiedFile: 'const x = 2;',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(message);

      expect(result).toBe(true);
      expect(handler.getCurrentDiff()).toEqual(message.payload);
    });

    it('should parse message with empty originalFile (new file)', () => {
      const message: SyncFullContextMessage = {
        id: 'msg-456',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'src/newfile.ts',
          originalFile: '',
          modifiedFile: 'export const newCode = true;',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(message);

      expect(result).toBe(true);
      const currentDiff = handler.getCurrentDiff();
      expect(currentDiff?.originalFile).toBe('');
      expect(currentDiff?.modifiedFile).toBe('export const newCode = true;');
    });

    it('should parse message with empty modifiedFile (deleted file)', () => {
      const message: SyncFullContextMessage = {
        id: 'msg-789',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'src/deleted.ts',
          originalFile: 'const deleted = true;',
          modifiedFile: '',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(message);

      expect(result).toBe(true);
      const currentDiff = handler.getCurrentDiff();
      expect(currentDiff?.originalFile).toBe('const deleted = true;');
      expect(currentDiff?.modifiedFile).toBe('');
    });

    it('should parse message with various file path formats', () => {
      const filePaths = [
        'README.md',
        'src/index.ts',
        'packages/mobile-client/App.tsx',
        'path/to/deeply/nested/file.js',
        'file-with-dashes.ts',
        'file_with_underscores.ts',
        'file.test.tsx',
      ];

      filePaths.forEach(fileName => {
        const message: SyncFullContextMessage = {
          id: `msg-${fileName}`,
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName,
            originalFile: 'original',
            modifiedFile: 'modified',
            isDirty: false,
            timestamp: Date.now(),
          },
        };

        const result = handler.handleMessage(message);
        expect(result).toBe(true);
        expect(handler.getCurrentDiff()?.fileName).toBe(fileName);
      });
    });

    it('should parse message with large file content', () => {
      const largeContent = 'x'.repeat(10000);
      const message: SyncFullContextMessage = {
        id: 'msg-large',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'large-file.ts',
          originalFile: largeContent,
          modifiedFile: largeContent + '\n// new line',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(message);

      expect(result).toBe(true);
      const currentDiff = handler.getCurrentDiff();
      expect(currentDiff?.originalFile.length).toBe(10000);
      expect(currentDiff?.modifiedFile.length).toBe(10012); // 10000 + '\n// new line' (12 chars)
    });
  });

  describe('Error Handling for Malformed Messages', () => {
    it('should reject message with wrong type', () => {
      const invalidMessage = {
        id: 'msg-wrong-type',
        timestamp: Date.now(),
        type: 'INJECT_PROMPT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(invalidMessage);

      expect(result).toBe(false);
      expect(handler.getCurrentDiff()).toBeNull();
    });

    it('should reject message with missing fileName', () => {
      const invalidMessage = {
        id: 'msg-no-filename',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(invalidMessage);

      expect(result).toBe(false);
      expect(handler.getCurrentDiff()).toBeNull();
    });

    it('should reject message with missing originalFile', () => {
      const invalidMessage = {
        id: 'msg-no-original',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it('should reject message with missing modifiedFile', () => {
      const invalidMessage = {
        id: 'msg-no-modified',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'original',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it('should reject message with missing isDirty', () => {
      const invalidMessage = {
        id: 'msg-no-dirty',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          timestamp: Date.now(),
        },
      };

      const result = handler.handleMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it('should reject message with missing payload timestamp', () => {
      const invalidMessage = {
        id: 'msg-no-timestamp',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
        },
      };

      const result = handler.handleMessage(invalidMessage);

      expect(result).toBe(false);
    });

    it('should reject message with wrong field types', () => {
      const invalidMessages = [
        // fileName is not a string
        {
          id: 'msg-1',
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: 123,
            originalFile: 'original',
            modifiedFile: 'modified',
            isDirty: false,
            timestamp: Date.now(),
          },
        },
        // isDirty is not a boolean
        {
          id: 'msg-2',
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: 'test.ts',
            originalFile: 'original',
            modifiedFile: 'modified',
            isDirty: 'true',
            timestamp: Date.now(),
          },
        },
        // timestamp is not a number
        {
          id: 'msg-3',
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: 'test.ts',
            originalFile: 'original',
            modifiedFile: 'modified',
            isDirty: false,
            timestamp: '123456',
          },
        },
      ];

      invalidMessages.forEach(invalidMessage => {
        const result = handler.handleMessage(invalidMessage);
        expect(result).toBe(false);
      });
    });

    it('should reject non-object messages', () => {
      const invalidMessages = [
        'string message',
        123,
        true,
        null,
        undefined,
        [],
      ];

      invalidMessages.forEach(invalidMessage => {
        const result = handler.handleMessage(invalidMessage);
        expect(result).toBe(false);
      });
    });

    it('should call error listeners when parsing fails', () => {
      const errorListener = vi.fn();
      handler.onError(errorListener);

      const invalidMessage = {
        id: 'msg-invalid',
        timestamp: Date.now(),
        type: 'WRONG_TYPE',
        payload: {},
      };

      handler.handleMessage(invalidMessage);

      expect(errorListener).toHaveBeenCalled();
      expect(errorListener.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('State Management', () => {
    it('should update current diff when message is handled', () => {
      const message: SyncFullContextMessage = {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file1.ts',
          originalFile: 'original1',
          modifiedFile: 'modified1',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      handler.handleMessage(message);

      const currentDiff = handler.getCurrentDiff();
      expect(currentDiff).toEqual(message.payload);
    });

    it('should add messages to history', () => {
      const messages: SyncFullContextMessage[] = [
        {
          id: 'msg-1',
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: 'file1.ts',
            originalFile: 'original1',
            modifiedFile: 'modified1',
            isDirty: false,
            timestamp: Date.now(),
          },
        },
        {
          id: 'msg-2',
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: 'file2.ts',
            originalFile: 'original2',
            modifiedFile: 'modified2',
            isDirty: true,
            timestamp: Date.now(),
          },
        },
      ];

      messages.forEach(msg => handler.handleMessage(msg));

      const history = handler.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].fileName).toBe('file1.ts');
      expect(history[1].fileName).toBe('file2.ts');
    });

    it('should update current diff to latest message', () => {
      const message1: SyncFullContextMessage = {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file1.ts',
          originalFile: 'original1',
          modifiedFile: 'modified1',
          isDirty: false,
          timestamp: 1000,
        },
      };

      const message2: SyncFullContextMessage = {
        id: 'msg-2',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file2.ts',
          originalFile: 'original2',
          modifiedFile: 'modified2',
          isDirty: true,
          timestamp: 2000,
        },
      };

      handler.handleMessage(message1);
      handler.handleMessage(message2);

      const currentDiff = handler.getCurrentDiff();
      expect(currentDiff?.fileName).toBe('file2.ts');
      expect(currentDiff?.timestamp).toBe(2000);
    });

    it('should maintain history limit', () => {
      const limitedHandler = new DiffMessageHandler(3);

      for (let i = 0; i < 5; i++) {
        const message: SyncFullContextMessage = {
          id: `msg-${i}`,
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: `file${i}.ts`,
            originalFile: `original${i}`,
            modifiedFile: `modified${i}`,
            isDirty: false,
            timestamp: i,
          },
        };
        limitedHandler.handleMessage(message);
      }

      const history = limitedHandler.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].fileName).toBe('file2.ts');
      expect(history[1].fileName).toBe('file3.ts');
      expect(history[2].fileName).toBe('file4.ts');
    });

    it('should call state change listeners when state updates', () => {
      const stateListener = vi.fn();
      handler.onStateChange(stateListener);

      const message: SyncFullContextMessage = {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file1.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      handler.handleMessage(message);

      expect(stateListener).toHaveBeenCalled();
      const state = stateListener.mock.calls[0][0];
      expect(state.currentDiff).toEqual(message.payload);
    });

    it('should support multiple state change listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      handler.onStateChange(listener1);
      handler.onStateChange(listener2);
      handler.onStateChange(listener3);

      const message: SyncFullContextMessage = {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file1.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      handler.handleMessage(message);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });

  describe('History Navigation', () => {
    beforeEach(() => {
      // Add some messages to history
      for (let i = 0; i < 3; i++) {
        const message: SyncFullContextMessage = {
          id: `msg-${i}`,
          timestamp: Date.now(),
          type: 'SYNC_FULL_CONTEXT',
          payload: {
            fileName: `file${i}.ts`,
            originalFile: `original${i}`,
            modifiedFile: `modified${i}`,
            isDirty: false,
            timestamp: i,
          },
        };
        handler.handleMessage(message);
      }
    });

    it('should select diff by index', () => {
      const result = handler.selectDiffByIndex(1);

      expect(result).toBe(true);
      const currentDiff = handler.getCurrentDiff();
      expect(currentDiff?.fileName).toBe('file1.ts');
    });

    it('should return false for invalid index', () => {
      expect(handler.selectDiffByIndex(-1)).toBe(false);
      expect(handler.selectDiffByIndex(10)).toBe(false);
    });

    it('should call state change listener when selecting diff', () => {
      const stateListener = vi.fn();
      handler.onStateChange(stateListener);

      handler.selectDiffByIndex(0);

      expect(stateListener).toHaveBeenCalled();
    });

    it('should clear history', () => {
      handler.clearHistory();

      expect(handler.getCurrentDiff()).toBeNull();
      expect(handler.getHistory().length).toBe(0);
    });

    it('should call state change listener when clearing history', () => {
      const stateListener = vi.fn();
      handler.onStateChange(stateListener);

      handler.clearHistory();

      expect(stateListener).toHaveBeenCalled();
      const state = stateListener.mock.calls[0][0];
      expect(state.currentDiff).toBeNull();
      expect(state.history.length).toBe(0);
    });
  });

  describe('getDiffState', () => {
    it('should return complete diff state', () => {
      const message: SyncFullContextMessage = {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file1.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      handler.handleMessage(message);

      const state = handler.getDiffState();
      expect(state.currentDiff).toEqual(message.payload);
      expect(state.history.length).toBe(1);
      expect(state.selectedIndex).toBe(0);
    });

    it('should return a copy of state (not reference)', () => {
      const message: SyncFullContextMessage = {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'file1.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      handler.handleMessage(message);

      const state1 = handler.getDiffState();
      const state2 = handler.getDiffState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });
});
