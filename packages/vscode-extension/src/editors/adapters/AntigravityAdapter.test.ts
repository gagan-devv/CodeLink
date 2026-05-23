import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AntigravityAdapter } from './AntigravityAdapter';

// Mock VS Code API
const mockGetCommands = vi.fn();
const mockExecuteCommand = vi.fn();

vi.mock('vscode', () => ({
  commands: {
    getCommands: () => mockGetCommands(),
    executeCommand: (cmd: string, ...args: any[]) => mockExecuteCommand(cmd, ...args),
  },
}));

describe('AntigravityAdapter', () => {
  let adapter: AntigravityAdapter;

  beforeEach(() => {
    adapter = new AntigravityAdapter();
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    it('should return isInstalled: true when antigravity commands are available', async () => {
      mockGetCommands.mockResolvedValue([
        'git.clone',
        'antigravity.chat.send',
        'antigravity.chat.open',
      ]);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(true);
      expect(result.availableCommands).toContain('antigravity.chat.send');
      expect(result.availableCommands).toContain('antigravity.chat.open');
    });

    it('should return isInstalled: false when no antigravity commands are available', async () => {
      mockGetCommands.mockResolvedValue([
        'git.clone',
        'continue.openChat',
      ]);

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(false);
      expect(result.availableCommands).toHaveLength(0);
    });

    it('should fail safe and return isInstalled: false if commands query throws an error', async () => {
      mockGetCommands.mockRejectedValue(new Error('VS Code internal failure'));

      const result = await adapter.detect();

      expect(result.isInstalled).toBe(false);
      expect(result.availableCommands).toHaveLength(0);
    });
  });

  describe('injectPrompt()', () => {
    it('should inject prompt successfully using primary command "antigravity.chat.send"', async () => {
      mockExecuteCommand.mockResolvedValue(undefined); // Simulate success

      const result = await adapter.injectPrompt('Hello Antigravity!');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('antigravity.chat.send');
      expect(mockExecuteCommand).toHaveBeenCalledWith('antigravity.chat.send', 'Hello Antigravity!');
    });

    it('should fallback to "antigravity.chat.open" if primary command fails', async () => {
      // Primary fails, Fallback 1 succeeds
      mockExecuteCommand
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockResolvedValueOnce(undefined);

      const result = await adapter.injectPrompt('Fix this file.');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('antigravity.chat.open');
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(1, 'antigravity.chat.send', 'Fix this file.');
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2, 'antigravity.chat.open', {
        message: 'Fix this file.',
      });
    });

    it('should fallback to "antigravity.sendMessage" if both previous commands fail', async () => {
      // Primary fails, Fallback 1 fails, Fallback 2 succeeds
      mockExecuteCommand
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockResolvedValueOnce(undefined);

      const result = await adapter.injectPrompt('Add comments.');

      expect(result.success).toBe(true);
      expect(result.commandUsed).toBe('antigravity.sendMessage');
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(3, 'antigravity.sendMessage', 'Add comments.');
    });

    it('should fail safe and return success: false if all fallbacks fail', async () => {
      // All fail
      mockExecuteCommand.mockRejectedValue(new Error('Extension offline'));

      const result = await adapter.injectPrompt('Optimize imports.');

      expect(result.success).toBe(false);
      expect(result.commandUsed).toBe('antigravity.chat.send (attempted)');
      expect(result.error).toContain('Failed to inject prompt into Antigravity');
    });
  });
});
