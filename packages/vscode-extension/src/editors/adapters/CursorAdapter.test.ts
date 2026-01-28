import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorAdapter } from './CursorAdapter';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  commands: {
    getCommands: vi.fn(),
    executeCommand: vi.fn(),
  },
}));

describe('CursorAdapter - Unit Tests', () => {
  let adapter: CursorAdapter;

  beforeEach(() => {
    adapter = new CursorAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Adapter Properties', () => {
    it('should have correct editorId', () => {
      expect(adapter.editorId).toBe('cursor');
    });

    it('should have correct editorName', () => {
      expect(adapter.editorName).toBe('Cursor');
    });

    // Requirement 3.5: Cursor supports control-only sync
    // Requirement 5.1: Cursor has limited capabilities due to closed-source nature
    // Requirement 5.3: System clearly documents what is and isn't possible per editor
    it('should declare control-only capabilities', () => {
      expect(adapter.capabilities).toEqual({
        canInjectPrompt: true,
        canReadChatHistory: false,
        canStreamAssistantTokens: false,
        canReadDiffArtifacts: false,
        canPreventAutoApply: false,
        syncLevel: 'control-only',
      });
    });

    // Requirement 5.3: Closed-source capabilities must be false
    it('should have all closed-source capabilities set to false', () => {
      expect(adapter.capabilities.canReadChatHistory).toBe(false);
      expect(adapter.capabilities.canStreamAssistantTokens).toBe(false);
      expect(adapter.capabilities.canReadDiffArtifacts).toBe(false);
    });
  });

  describe('detect()', () => {
    // Requirement 1.1: System detects available AI editors by querying VS Code commands
    it('should detect Cursor when cursor.* commands are present', async () => {
      const commands = [
        'cursor.chat.newMessage',
        'cursor.openChat',
        'cursor.sendMessage',
        'workbench.action.files.save',
        'editor.action.formatDocument',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual([
        'cursor.chat.newMessage',
        'cursor.openChat',
        'cursor.sendMessage',
      ]);
    });

    it('should detect Cursor when commands contain "cursor" in lowercase', async () => {
      const commands = [
        'some.cursor.command',
        'workbench.action.files.save',
        'editor.action.formatDocument',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toContain('some.cursor.command');
    });

    // Requirement 1.1: Detection happens dynamically without hardcoded assumptions
    it('should not detect Cursor when cursor commands are absent', async () => {
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

    it('should match commands with "cursor." prefix', async () => {
      const commands = [
        'cursor.validCommand',
        'cursorX.notValid',
        'xcursor.notValid',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toContain('cursor.validCommand');
    });

    it('should match commands containing "cursor" anywhere (case-insensitive)', async () => {
      const commands = [
        'some.CURSOR.command',
        'anotherCursorCommand',
        'workbench.action.files.save',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toContain('some.CURSOR.command');
      expect(result.availableCommands).toContain('anotherCursorCommand');
    });
  });

  describe('injectPrompt()', () => {
    // Requirement 2.1: Prompts originating from mobile appear in the editor's chat panel
    // Requirement 2.2: Injection uses only public VS Code commands
    it('should inject prompt successfully using primary command', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await adapter.injectPrompt('Hello, Cursor!');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('cursor.chat.newMessage');
      expect(result.error).toBeUndefined();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'cursor.chat.newMessage',
        'Hello, Cursor!'
      );
    });

    // Test fallback command patterns
    it('should use first fallback command when primary fails', async () => {
      vi.mocked(vscode.commands.executeCommand)
        .mockRejectedValueOnce(new Error('Primary command not found'))
        .mockResolvedValueOnce(undefined);

      const result = await adapter.injectPrompt('Test prompt');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('cursor.openChat');

      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        1,
        'cursor.chat.newMessage',
        'Test prompt'
      );
      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        2,
        'cursor.openChat',
        { message: 'Test prompt' }
      );
    });

    it('should use second fallback command when first two fail', async () => {
      vi.mocked(vscode.commands.executeCommand)
        .mockRejectedValueOnce(new Error('Primary command not found'))
        .mockRejectedValueOnce(new Error('First fallback not found'))
        .mockResolvedValueOnce(undefined);

      const result = await adapter.injectPrompt('Test prompt');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('cursor.sendMessage');

      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(3);
      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        3,
        'cursor.sendMessage',
        'Test prompt'
      );
    });

    // Requirement 2.5: System provides clear error messages when prompt injection fails
    it('should return error result when all command attempts fail', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        new Error('Command not found')
      );

      const result = await adapter.injectPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to inject prompt into Cursor');
      expect(result.error).toContain('Command not found');
      expect(result.error).toContain('cursor.chat.newMessage');
      expect(result.error).toContain('cursor.openChat');
      expect(result.error).toContain('cursor.sendMessage');
      expect(result.commandUsed).toBe('cursor.chat.newMessage (attempted)');
    });

    it('should handle empty prompt string', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await adapter.injectPrompt('');

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'cursor.chat.newMessage',
        ''
      );
    });

    it('should handle multiline prompts', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const multilinePrompt = 'Line 1\nLine 2\nLine 3';
      const result = await adapter.injectPrompt(multilinePrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'cursor.chat.newMessage',
        multilinePrompt
      );
    });

    it('should handle prompts with special characters', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const specialPrompt = 'Test !@#$%^&*() <>"\'';
      const result = await adapter.injectPrompt(specialPrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'cursor.chat.newMessage',
        specialPrompt
      );
    });

    it('should handle very long prompts', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const longPrompt = 'a'.repeat(10000);
      const result = await adapter.injectPrompt(longPrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'cursor.chat.newMessage',
        longPrompt
      );
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        'String error'
      );

      const result = await adapter.injectPrompt('Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to inject prompt into Cursor');
      expect(result.error).toContain('String error');
    });
  });

  describe('Interface Compliance', () => {
    it('should implement IEditorAdapter interface', () => {
      expect(adapter).toHaveProperty('editorId');
      expect(adapter).toHaveProperty('editorName');
      expect(adapter).toHaveProperty('capabilities');
      expect(adapter).toHaveProperty('detect');
      expect(adapter).toHaveProperty('injectPrompt');
    });

    it('should have detect method that returns Promise', () => {
      expect(typeof adapter.detect).toBe('function');
      expect(adapter.detect()).toBeInstanceOf(Promise);
    });

    it('should have injectPrompt method that returns Promise', () => {
      expect(typeof adapter.injectPrompt).toBe('function');
      expect(adapter.injectPrompt('test')).toBeInstanceOf(Promise);
    });

    // Requirement 5.3: Closed-source editors should not implement read methods
    it('should not have readChatHistory method', () => {
      expect(adapter).not.toHaveProperty('readChatHistory');
    });

    it('should not have readDiffArtifacts method', () => {
      expect(adapter).not.toHaveProperty('readDiffArtifacts');
    });
  });
});
