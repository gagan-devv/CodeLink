import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import {
  EditorAdapterErrorType,
  safeExecuteCommand,
  requireCapability,
  requireMethod,
  formatAdapterError,
  createAdapterError,
  executeWithCapabilityCheck,
} from './errors';
import { IEditorAdapter, EditorCapabilities } from './types';

// Mock vscode module
vi.mock('vscode', () => ({
  commands: {
    executeCommand: vi.fn(),
  },
}));

describe('Error Utilities - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('safeExecuteCommand()', () => {
    // Requirement 6.4: Always fails safe when operations cannot be completed
    it('should return success result when command executes successfully', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await safeExecuteCommand('test.command', { arg: 'value' });

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('test.command');
      expect(result.error).toBeUndefined();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'test.command',
        { arg: 'value' }
      );
    });

    // Requirement 6.4: Always fails safe when operations cannot be completed
    // Requirement 6.6: System provides clear error messages for unsupported operations
    it('should catch exceptions and return error result', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        new Error('Command not found')
      );

      const result = await safeExecuteCommand('invalid.command');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Command \'invalid.command\' failed');
      expect(result.error).toContain('Command not found');
      expect(result.commandUsed).toBe('invalid.command');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        'String error message'
      );

      const result = await safeExecuteCommand('test.command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('String error message');
    });

    it('should handle commands with no arguments', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await safeExecuteCommand('test.command');

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('test.command');
    });

    it('should handle commands with multiple arguments', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await safeExecuteCommand('test.command', 'arg1', 'arg2', 'arg3');

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'test.command',
        'arg1',
        'arg2',
        'arg3'
      );
    });
  });

  describe('requireCapability()', () => {
    const createMockAdapter = (capabilities: Partial<EditorCapabilities>): IEditorAdapter => ({
      editorId: 'test',
      editorName: 'Test Editor',
      capabilities: {
        canInjectPrompt: false,
        canReadChatHistory: false,
        canStreamAssistantTokens: false,
        canReadDiffArtifacts: false,
        canPreventAutoApply: false,
        syncLevel: 'control-only',
        ...capabilities,
      },
      detect: vi.fn(),
      injectPrompt: vi.fn(),
    });

    // Requirement 6.4: Always fails safe when operations cannot be completed
    it('should not throw when adapter has the required capability', () => {
      const adapter = createMockAdapter({ canReadChatHistory: true });

      expect(() => {
        requireCapability(adapter, 'canReadChatHistory', 'reading chat history');
      }).not.toThrow();
    });

    // Requirement 6.6: System provides clear error messages for unsupported operations
    it('should throw clear error when adapter lacks the required capability', () => {
      const adapter = createMockAdapter({ canReadChatHistory: false });

      expect(() => {
        requireCapability(adapter, 'canReadChatHistory', 'reading chat history');
      }).toThrow('Editor Test Editor does not support reading chat history');
    });

    it('should include sync level in error message', () => {
      const adapter = createMockAdapter({
        canReadChatHistory: false,
        syncLevel: 'control-only',
      });

      expect(() => {
        requireCapability(adapter, 'canReadChatHistory', 'reading chat history');
      }).toThrow('Sync level: control-only');
    });

    it('should include capability name in error message', () => {
      const adapter = createMockAdapter({ canStreamAssistantTokens: false });

      expect(() => {
        requireCapability(adapter, 'canStreamAssistantTokens', 'streaming tokens');
      }).toThrow('Capability \'canStreamAssistantTokens\' is not available');
    });

    it('should work with different capability types', () => {
      const adapter = createMockAdapter({
        canInjectPrompt: true,
        canReadDiffArtifacts: true,
        canPreventAutoApply: true,
      });

      expect(() => {
        requireCapability(adapter, 'canInjectPrompt', 'injecting prompts');
      }).not.toThrow();

      expect(() => {
        requireCapability(adapter, 'canReadDiffArtifacts', 'reading diffs');
      }).not.toThrow();

      expect(() => {
        requireCapability(adapter, 'canPreventAutoApply', 'preventing auto-apply');
      }).not.toThrow();
    });
  });

  describe('requireMethod()', () => {
    it('should not throw when adapter has the required method', () => {
      const adapter: IEditorAdapter = {
        editorId: 'test',
        editorName: 'Test Editor',
        capabilities: {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'partial',
        },
        detect: vi.fn(),
        injectPrompt: vi.fn(),
        readChatHistory: vi.fn(),
      };

      expect(() => {
        requireMethod(adapter, 'readChatHistory', 'canReadChatHistory');
      }).not.toThrow();
    });

    // Requirement 6.6: System provides clear error messages for unsupported operations
    it('should throw clear error when method is missing', () => {
      const adapter: IEditorAdapter = {
        editorId: 'test',
        editorName: 'Test Editor',
        capabilities: {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'partial',
        },
        detect: vi.fn(),
        injectPrompt: vi.fn(),
        // readChatHistory is missing
      };

      expect(() => {
        requireMethod(adapter, 'readChatHistory', 'canReadChatHistory');
      }).toThrow(
        'Editor Test Editor claims to support \'canReadChatHistory\' but does not implement readChatHistory() method'
      );
    });

    it('should throw error when method is not a function', () => {
      const adapter: any = {
        editorId: 'test',
        editorName: 'Test Editor',
        capabilities: {
          canReadChatHistory: true,
          syncLevel: 'partial',
        },
        detect: vi.fn(),
        injectPrompt: vi.fn(),
        readChatHistory: 'not a function',
      };

      expect(() => {
        requireMethod(adapter, 'readChatHistory', 'canReadChatHistory');
      }).toThrow('does not implement readChatHistory() method');
    });
  });

  describe('formatAdapterError()', () => {
    const mockAdapter: IEditorAdapter = {
      editorId: 'test',
      editorName: 'Test Editor',
      capabilities: {
        canInjectPrompt: true,
        canReadChatHistory: false,
        canStreamAssistantTokens: false,
        canReadDiffArtifacts: false,
        canPreventAutoApply: false,
        syncLevel: 'control-only',
      },
      detect: vi.fn(),
      injectPrompt: vi.fn(),
    };

    // Requirement 6.6: System provides clear error messages for unsupported operations
    it('should format error with adapter name and operation', () => {
      const error = new Error('Something went wrong');
      const formatted = formatAdapterError(mockAdapter, 'inject prompt', error);

      expect(formatted).toContain('Failed to inject prompt');
      expect(formatted).toContain('Test Editor');
      expect(formatted).toContain('test');
      expect(formatted).toContain('Something went wrong');
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error message');
      const formatted = formatAdapterError(mockAdapter, 'detect editor', error);

      expect(formatted).toContain('Test error message');
    });

    it('should handle non-Error exceptions', () => {
      const formatted = formatAdapterError(mockAdapter, 'test operation', 'String error');

      expect(formatted).toContain('String error');
    });

    it('should include editor ID in parentheses', () => {
      const formatted = formatAdapterError(mockAdapter, 'test', new Error('error'));

      expect(formatted).toMatch(/Test Editor \(test\)/);
    });
  });

  describe('createAdapterError()', () => {
    it('should create structured error with all fields', () => {
      const error = createAdapterError(
        EditorAdapterErrorType.COMMAND_EXECUTION_FAILED,
        'Command failed',
        { command: 'test.command' }
      );

      expect(error.success).toBe(false);
      expect(error.error).toBe('Command failed');
      expect(error.errorCode).toBe(EditorAdapterErrorType.COMMAND_EXECUTION_FAILED);
      expect(error.details).toEqual({ command: 'test.command' });
    });

    it('should create error without details', () => {
      const error = createAdapterError(
        EditorAdapterErrorType.EDITOR_NOT_FOUND,
        'Editor not found'
      );

      expect(error.success).toBe(false);
      expect(error.error).toBe('Editor not found');
      expect(error.errorCode).toBe(EditorAdapterErrorType.EDITOR_NOT_FOUND);
      expect(error.details).toBeUndefined();
    });

    it('should support all error types', () => {
      const errorTypes = [
        EditorAdapterErrorType.COMMAND_EXECUTION_FAILED,
        EditorAdapterErrorType.EDITOR_NOT_FOUND,
        EditorAdapterErrorType.UNSUPPORTED_OPERATION,
        EditorAdapterErrorType.CAPABILITY_CHECK_FAILED,
        EditorAdapterErrorType.UNKNOWN_ERROR,
      ];

      errorTypes.forEach((type) => {
        const error = createAdapterError(type, 'Test message');
        expect(error.errorCode).toBe(type);
      });
    });
  });

  describe('executeWithCapabilityCheck()', () => {
    const createMockAdapter = (capabilities: Partial<EditorCapabilities>): IEditorAdapter => ({
      editorId: 'test',
      editorName: 'Test Editor',
      capabilities: {
        canInjectPrompt: false,
        canReadChatHistory: false,
        canStreamAssistantTokens: false,
        canReadDiffArtifacts: false,
        canPreventAutoApply: false,
        syncLevel: 'control-only',
        ...capabilities,
      },
      detect: vi.fn(),
      injectPrompt: vi.fn(),
    });

    // Requirement 6.4: Always fails safe when operations cannot be completed
    it('should execute operation when capability is present', async () => {
      const adapter = createMockAdapter({ canReadChatHistory: true });
      const operation = vi.fn().mockResolvedValue('success');

      const result = await executeWithCapabilityCheck(
        adapter,
        'canReadChatHistory',
        'reading chat history',
        operation
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    // Requirement 6.6: System provides clear error messages for unsupported operations
    it('should throw formatted error when capability is missing', async () => {
      const adapter = createMockAdapter({ canReadChatHistory: false });
      const operation = vi.fn().mockResolvedValue('success');

      await expect(
        executeWithCapabilityCheck(
          adapter,
          'canReadChatHistory',
          'reading chat history',
          operation
        )
      ).rejects.toThrow('Failed to reading chat history for editor Test Editor');

      expect(operation).not.toHaveBeenCalled();
    });

    it('should propagate operation errors with formatting', async () => {
      const adapter = createMockAdapter({ canReadChatHistory: true });
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        executeWithCapabilityCheck(
          adapter,
          'canReadChatHistory',
          'reading chat history',
          operation
        )
      ).rejects.toThrow('Failed to reading chat history for editor Test Editor');
    });

    it('should return operation result on success', async () => {
      const adapter = createMockAdapter({ canInjectPrompt: true });
      const operation = vi.fn().mockResolvedValue({ data: 'test' });

      const result = await executeWithCapabilityCheck(
        adapter,
        'canInjectPrompt',
        'injecting prompt',
        operation
      );

      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('EditorAdapterErrorType enum', () => {
    it('should have all required error types', () => {
      expect(EditorAdapterErrorType.COMMAND_EXECUTION_FAILED).toBe('COMMAND_EXECUTION_FAILED');
      expect(EditorAdapterErrorType.EDITOR_NOT_FOUND).toBe('EDITOR_NOT_FOUND');
      expect(EditorAdapterErrorType.UNSUPPORTED_OPERATION).toBe('UNSUPPORTED_OPERATION');
      expect(EditorAdapterErrorType.CAPABILITY_CHECK_FAILED).toBe('CAPABILITY_CHECK_FAILED');
      expect(EditorAdapterErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });
});
