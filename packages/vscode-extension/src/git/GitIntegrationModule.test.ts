import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitIntegrationModuleImpl } from './GitIntegrationModule';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    asRelativePath: vi.fn((path: string) => {
      // Simple mock: extract filename from path
      const parts = path.split('/');
      return parts[parts.length - 1];
    }),
  },
}));

// Mock simple-git
vi.mock('simple-git', () => {
  const mockGit = {
    revparse: vi.fn(),
    show: vi.fn(),
  };

  return {
    default: vi.fn(() => mockGit),
    __mockGit: mockGit,
  };
});

describe('GitIntegrationModule', () => {
  let gitModule: GitIntegrationModuleImpl;
  let mockGit: any;

  beforeEach(async () => {
    gitModule = new GitIntegrationModuleImpl();
    
    // Get the mock git instance
    const simpleGit = await import('simple-git');
    mockGit = (simpleGit as any).__mockGit;
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should find repository root correctly', async () => {
      mockGit.revparse.mockResolvedValue('/home/user/project\n');

      const result = await gitModule.initialize('/home/user/project');

      expect(result).toBe(true);
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });

    it('should return false when Git repository not found', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));

      const result = await gitModule.initialize('/home/user/not-a-repo');

      expect(result).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Permission denied'));

      const result = await gitModule.initialize('/home/user/no-permission');

      expect(result).toBe(false);
    });
  });

  describe('getHeadVersion', () => {
    beforeEach(async () => {
      mockGit.revparse.mockResolvedValue('/home/user/project\n');
      await gitModule.initialize('/home/user/project');
    });

    it('should return HEAD content for tracked files', async () => {
      const expectedContent = 'const x = 1;\nconsole.log(x);';
      mockGit.show.mockResolvedValue(expectedContent);

      const content = await gitModule.getHeadVersion('/home/user/project/src/index.ts');

      expect(content).toBe(expectedContent);
      expect(mockGit.show).toHaveBeenCalledWith(['HEAD:index.ts']);
    });

    it('should return empty string for untracked files', async () => {
      mockGit.show.mockRejectedValue(new Error('Path not in HEAD'));

      const content = await gitModule.getHeadVersion('/home/user/project/src/newfile.ts');

      expect(content).toBe('');
    });

    it('should return empty string for newly added files', async () => {
      mockGit.show.mockRejectedValue(new Error('fatal: path not in HEAD'));

      const content = await gitModule.getHeadVersion('/home/user/project/src/added.ts');

      expect(content).toBe('');
    });

    it('should handle Git operation failures', async () => {
      mockGit.show.mockRejectedValue(new Error('Git command failed'));

      const content = await gitModule.getHeadVersion('/home/user/project/src/file.ts');

      expect(content).toBe('');
    });

    it('should return empty string when not initialized', async () => {
      const uninitializedModule = new GitIntegrationModuleImpl();

      const content = await uninitializedModule.getHeadVersion('/some/path/file.ts');

      expect(content).toBe('');
    });
  });

  describe('isTracked', () => {
    beforeEach(async () => {
      mockGit.revparse.mockResolvedValue('/home/user/project\n');
      await gitModule.initialize('/home/user/project');
    });

    it('should return true for tracked files', async () => {
      mockGit.show.mockResolvedValue('file content');

      const isTracked = await gitModule.isTracked('/home/user/project/src/tracked.ts');

      expect(isTracked).toBe(true);
    });

    it('should return false for untracked files', async () => {
      mockGit.show.mockRejectedValue(new Error('Path not in HEAD'));

      const isTracked = await gitModule.isTracked('/home/user/project/src/untracked.ts');

      expect(isTracked).toBe(false);
    });

    it('should return false when not initialized', async () => {
      const uninitializedModule = new GitIntegrationModuleImpl();

      const isTracked = await uninitializedModule.isTracked('/some/path/file.ts');

      expect(isTracked).toBe(false);
    });
  });

  describe('path conversion', () => {
    beforeEach(async () => {
      mockGit.revparse.mockResolvedValue('/home/user/project\n');
      await gitModule.initialize('/home/user/project');
    });

    it('should convert absolute path to relative path', async () => {
      // Mock asRelativePath to return a proper relative path
      (vscode.workspace.asRelativePath as any).mockReturnValue('src/components/Button.tsx');
      mockGit.show.mockResolvedValue('content');

      await gitModule.getHeadVersion('/home/user/project/src/components/Button.tsx');

      expect(mockGit.show).toHaveBeenCalledWith(['HEAD:src/components/Button.tsx']);
    });

    it('should normalize Windows path separators', async () => {
      // Mock asRelativePath to return Windows-style path
      (vscode.workspace.asRelativePath as any).mockReturnValue('src\\utils\\helper.ts');
      mockGit.show.mockResolvedValue('content');

      await gitModule.getHeadVersion('C:\\project\\src\\utils\\helper.ts');

      // Should convert backslashes to forward slashes for Git
      expect(mockGit.show).toHaveBeenCalledWith(['HEAD:src/utils/helper.ts']);
    });
  });
});
