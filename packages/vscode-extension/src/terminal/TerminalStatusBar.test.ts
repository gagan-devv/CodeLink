import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
    workspaceFolders: [],
    isTrusted: true,
  },
  window: {
    createStatusBarItem: vi.fn(() => ({
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  StatusBarAlignment: { Right: 2 },
}));

import {
  formatSafeShellCommand,
  resolveCompanionPath,
} from './TerminalStatusBar';

describe('TerminalStatusBar Launcher Security (Fix B)', () => {
  describe('formatSafeShellCommand', () => {
    it('formats benign paths without redundant quotes', () => {
      const cmd = formatSafeShellCommand('node', '/usr/local/bin/codelink.js', 'status');
      expect(cmd).toBe('node /usr/local/bin/codelink.js status');
    });

    it('quotes paths with spaces safely', () => {
      const cmd = formatSafeShellCommand(
        'node',
        '/Users/john doe/projects/codelink-terminal.js',
        'status'
      );
      expect(cmd).toBe("node '/Users/john doe/projects/codelink-terminal.js' status");
    });

    it('neutralizes command injection via $ variable expansion', () => {
      const malicious = '/opt/$HOME/evil`id`.js';
      const cmd = formatSafeShellCommand('node', malicious, 'start-daemon');
      // Must be single-quoted so $HOME and `id` are not evaluated by shells
      expect(cmd).toBe("node '/opt/$HOME/evil`id`.js' start-daemon");
    });

    it('neutralizes backticks in executable or script paths', () => {
      const malicious = '/tmp/test`touch /tmp/pwned`.js';
      const cmd = formatSafeShellCommand('node', malicious, 'status');
      expect(cmd).toContain("'/tmp/test`touch /tmp/pwned`.js'");
    });

    it('neutralizes internal quotes and semicolons in paths', () => {
      const malicious = "/tmp/dir'with;quotes\"/script.js";
      const cmd = formatSafeShellCommand('node', malicious, 'status');
      // Expect POSIX-compliant single-quote escaping: '\''
      expect(cmd).toBe("node '/tmp/dir'\\''with;quotes\"/script.js' status");
    });
  });

  describe('resolveCompanionPath & Workspace Trust', () => {
    it('refuses to execute repo-built companion in an untrusted workspace', () => {
      const mockWf = [{ uri: { fsPath: '/home/user/malicious-repo' } }] as any;
      const res = resolveCompanionPath(undefined, mockWf, false, '/ext/dist/terminal');

      expect(res.path).toBeNull();
      expect(res.error).toContain('untrusted workspace');
    });

    it('allows explicitly configured path even if workspace is untrusted', () => {
      // Create a temporary mock file
      const tempPath = path.join(__dirname, 'mock-companion.js');
      fs.writeFileSync(tempPath, '// mock companion', 'utf8');

      try {
        const mockWf = [{ uri: { fsPath: '/home/user/malicious-repo' } }] as any;
        const res = resolveCompanionPath(tempPath, mockWf, false, '/ext/dist/terminal');

        expect(res.path).toBe(tempPath);
        expect(res.error).toBeUndefined();
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    });

    it('returns error if explicitly configured path does not exist', () => {
      const res = resolveCompanionPath('/non/existent/codelink.js', undefined, true);
      expect(res.path).toBeNull();
      expect(res.error).toContain('does not exist');
    });

    it('resolves real repo companion path when workspace is trusted', () => {
      // In this repo, packages/companion/dist/bin/codelink-terminal.js exists
      const repoRoot = path.resolve(__dirname, '../../../..');
      const mockWf = [{ uri: { fsPath: repoRoot } }] as any;

      const res = resolveCompanionPath(undefined, mockWf, true, path.join(repoRoot, 'packages/vscode-extension/dist/terminal'));
      expect(res.path).not.toBeNull();
      expect(res.path).toContain('codelink-terminal.js');
      expect(fs.existsSync(res.path!)).toBe(true);
    });
  });
});
