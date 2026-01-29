import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KiroAdapter } from './KiroAdapter';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  commands: {
    getCommands: vi.fn(),
    executeCommand: vi.fn(),
  },
}));

describe('KiroAdapter - Unit Tests', () => {
  let adapter: KiroAdapter;

  beforeEach(() => {
    adapter = new KiroAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Adapter Properties', () => {
    it('should have correct editorId', () => {
      expect(adapter.editorId).toBe('kiro');
    });

    it('should have correct editorName', () => {
      expect(adapter.editorName).toBe('Kiro');
    });

    // Requirement 3.4: Kiro supports partial sync
    it('should declare partial sync capabilities', () => {
      expect(adapter.capabilities).toEqual({
        canInjectPrompt: true,
        canReadChatHistory: true,
        canStreamAssistantTokens: true,
        canReadDiffArtifacts: true,
        canPreventAutoApply: true,
        syncLevel: 'partial',
      });
    });
  });

  describe('detect()', () => {
    // Requirement 1.1: System detects available AI editors
    it('should always detect Kiro as installed', async () => {
      const commands = [
        'kiro.chat.sendMessage',
        'kiro.openSettings',
        'workbench.action.files.save',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual([
        'kiro.chat.sendMessage',
        'kiro.openSettings',
      ]);
    });

    it('should detect Kiro even when no kiro.* commands are found', async () => {
      const commands = [
        'workbench.action.files.save',
        'editor.action.formatDocument',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      // Kiro is always installed since we ARE Kiro
      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual([]);
    });

    it('should detect Kiro even when command query fails', async () => {
      vi.mocked(vscode.commands.getCommands).mockRejectedValue(
        new Error('VS Code API unavailable')
      );

      const result = await adapter.detect();

      // Kiro is always installed since we ARE Kiro
      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual([]);
    });

    it('should only match commands with exact "kiro." prefix', async () => {
      const commands = [
        'kiro.validCommand',
        'kiroX.notValid',
        'xkiro.notValid',
        'KIRO.notValid',
        'Kiro.notValid',
      ];

      vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual(['kiro.validCommand']);
    });

    it('should return empty array when no commands exist', async () => {
      vi.mocked(vscode.commands.getCommands).mockResolvedValue([]);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toEqual([]);
    });
  });

  describe('injectPrompt()', () => {
    // Requirement 2.1: Prompts originating from mobile appear in the editor's chat panel
    it('should inject prompt successfully using Kiro command', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await adapter.injectPrompt('Hello, Kiro!');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('kiro.chat.sendMessage');
      expect(result.error).toBeUndefined();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'kiro.chat.sendMessage',
        { message: 'Hello, Kiro!' }
      );
    });

    it('should return error result when command execution fails', async () => {
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(
        new Error('Command not found')
      );

      const result = await adapter.injectPrompt('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to inject prompt');
      expect(result.error).toContain('Command not found');
      expect(result.commandUsed).toBe('kiro.chat.sendMessage');
    });

    it('should handle empty prompt string', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const result = await adapter.injectPrompt('');

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'kiro.chat.sendMessage',
        { message: '' }
      );
    });

    it('should handle multiline prompts', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const multilinePrompt = 'Line 1\nLine 2\nLine 3';
      const result = await adapter.injectPrompt(multilinePrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'kiro.chat.sendMessage',
        { message: multilinePrompt }
      );
    });

    it('should handle prompts with special characters', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const specialPrompt = 'Test !@#$%^&*() <>"\'';
      const result = await adapter.injectPrompt(specialPrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'kiro.chat.sendMessage',
        { message: specialPrompt }
      );
    });

    it('should handle very long prompts', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      const longPrompt = 'a'.repeat(10000);
      const result = await adapter.injectPrompt(longPrompt);

      expect(result.success).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'kiro.chat.sendMessage',
        { message: longPrompt }
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
        'readChatHistory not yet implemented for Kiro adapter'
      );
    });
  });

  describe('readDiffArtifacts()', () => {
    it('should throw not implemented error', async () => {
      await expect(adapter.readDiffArtifacts()).rejects.toThrow(
        'readDiffArtifacts not yet implemented for Kiro adapter'
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
