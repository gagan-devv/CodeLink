import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContinueAdapter } from './ContinueAdapter';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  commands: {
    getCommands: vi.fn(),
    executeCommand: vi.fn(),
  },
}));

describe('ContinueAdapter - Unit Tests', () => {
  let adapter: ContinueAdapter;

  beforeEach(() => {
    adapter = new ContinueAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Adapter Properties', () => {
    it('should have correct editorId', () => {
      expect(adapter.editorId).toBe('continue');
    });

    it('should have correct editorName', () => {
      expect(adapter.editorName).toBe('Continue');
    });

    it('should declare full sync capabilities', () => {
      expect(adapter.capabilities).toEqual({
        canInjectPrompt: true,
        canReadChatHistory: true,
        canStreamAssistantTokens: true,
        canReadDiffArtifacts: true,
        canPreventAutoApply: true,
        syncLevel: 'full',
      });
    });
  });

  describe('detect()', () => {
    // Requirement 1.1: System detects available AI editors by querying VS Code commands
    it('should detect Continue when continue.* commands are present', async () => {
      const commands = [
        'continue.continueGUIView.focusContinueInput',
        'continue.openSettings',
        'continue.toggleFullScreen',
        'workbench.action.files.save',
        'editor.action.formatDocument',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual([
        'continue.continueGUIView.focusContinueInput',
        'continue.openSettings',
        'continue.toggleFullScreen',
      ]);
    });

    // Requirement 1.1: Detection happens dynamically without hardcoded assumptions
    it('should not detect Continue when continue.* commands are absent', async () => {
      const commands = [
        'workbench.action.files.save',
        'editor.action.formatDocument',
        'git.commit',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(false);
      expect(result.availableCommands).toEqual([]);
    });

    it('should return empty array when no commands exist', async () => {
      vi.mocked(vscode.commands.getCommands).mockResolvedValue([]);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(false);
      expect(result.availableCommands).toEqual([]);
    });

    it('should handle command query failure gracefully', async () => {
      vi.mocked(vscode.commands.getCommands).mockRejectedValue(
        new Error('VS Code API unavailable')
      );

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(false);
      expect(result.availableCommands).toEqual([]);
    });

    it('should only match commands with exact "continue." prefix', async () => {
      const commands = [
        'continue.validCommand',
        'continueX.notValid',
        'xcontinue.notValid',
        'CONTINUE.notValid',
        'Continue.notValid',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual(['continue.validCommand']);
    });
  });

  describe('injectPrompt()', () => {
    // Requirement 2.1: Prompts originating from mobile appear in the editor's chat panel
    // Requirement 2.2: Injection uses only public VS Code commands
    it('should inject prompt successfully using Continue command', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await adapter.injectPrompt('Hello, Continue!');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe(
        'continue.continueGUIView.focusContinueInput'
      );
      expect(result.error).toBeUndefined();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'continue.continueGUIView.focusContinueInput',
        { text: 'Hello, Continue!' }
      );
    });

    // Requirement 2.5: System provides clear error messages when prompt injection fails
    it('should return error result when command execution fails', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        new Error('Command not found')
      );

      const result = await adapter.injectPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to inject prompt');
      expect(result.error).toContain('Command not found');
      expect(result.commandUsed).toBe(
        'continue.continueGUIView.focusContinueInput'
      );
    });

    it('should handle empty prompt string', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await adapter.injectPrompt('');

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'continue.continueGUIView.focusContinueInput',
        { text: '' }
      );
    });

    it('should handle multiline prompts', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const multilinePrompt = 'Line 1\nLine 2\nLine 3';
      const result = await adapter.injectPrompt(multilinePrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'continue.continueGUIView.focusContinueInput',
        { text: multilinePrompt }
      );
    });

    it('should handle prompts with special characters', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const specialPrompt = 'Test !@#$%^&*() <>"\'';
      const result = await adapter.injectPrompt(specialPrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'continue.continueGUIView.focusContinueInput',
        { text: specialPrompt }
      );
    });

    it('should handle very long prompts', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const longPrompt = 'a'.repeat(10000);
      const result = await adapter.injectPrompt(longPrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'continue.continueGUIView.focusContinueInput',
        { text: longPrompt }
      );
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        'String error'
      );

      const result = await adapter.injectPrompt('Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to inject prompt');
      expect(result.error).toContain('String error');
    });
  });

  describe('readChatHistory()', () => {
    it('should throw not implemented error', async () => {
      await expect(adapter.readChatHistory()).rejects.toThrow(
        'readChatHistory not yet implemented for Continue adapter'
      );
    });
  });

  describe('readDiffArtifacts()', () => {
    it('should throw not implemented error', async () => {
      await expect(adapter.readDiffArtifacts()).rejects.toThrow(
        'readDiffArtifacts not yet implemented for Continue adapter'
      );
    });
  });

  describe('Interface Compliance', () => {
    it('should implement IEditorAdapter interface', () => {
      expect(adapter).toHaveProperty('editorId');
      expect(adapter).toHaveProperty('editorName');
      expect(adapter).toHaveProperty('capabilities');
      expect(adapter).toHaveProperty('detect');
      expect(adapter).toHaveProperty('injectPrompt');
      expect(adapter).toHaveProperty('readChatHistory');
      expect(adapter).toHaveProperty('readDiffArtifacts');
    });

    it('should have detect method that returns Promise', () => {
      expect(typeof adapter.detect).toBe('function');
      expect(adapter.detect()).toBeInstanceOf(Promise);
    });

    it('should have injectPrompt method that returns Promise', () => {
      expect(typeof adapter.injectPrompt).toBe('function');
      expect(adapter.injectPrompt('test')).toBeInstanceOf(Promise);
    });
  });
});
