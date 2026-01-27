import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { DiffGeneratorImpl } from './diff/DiffGenerator';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  workspace: {
    workspaceFolders: [],
    asRelativePath: vi.fn((path: string) => {
      const parts = path.split('/');
      return parts[parts.length - 1];
    }),
    textDocuments: [],
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
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

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

describe('VS Code Extension Error Handling', () => {
  let gitModule: GitIntegrationModuleImpl;
  let diffGenerator: DiffGeneratorImpl;
  let mockGit: any;
  let mockFs: any;

  beforeEach(async () => {
    gitModule = new GitIntegrationModuleImpl();
    diffGenerator = new DiffGeneratorImpl();

    // Get mock instances
    const simpleGit = await import('simple-git');
    mockGit = (simpleGit as any).__mockGit;

    const fs = await import('fs/promises');
    mockFs = fs;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Git Error Handling', () => {
    it('should handle Git repository not found error', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));

      const result = await gitModule.initialize('/not/a/repo');

      expect(result).toBe(false);
      // Should not throw, should handle gracefully
    });

    it('should handle Git permission denied error', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Permission denied'));

      const result = await gitModule.initialize('/no/permission');

      expect(result).toBe(false);
    });

    it('should handle Git command timeout', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Command timeout'));

      const result = await gitModule.initialize('/timeout/repo');

      expect(result).toBe(false);
    });

    it('should handle Git show command failure', async () => {
      mockGit.revparse.mockResolvedValue('/repo\n');
      await gitModule.initialize('/repo');

      mockGit.show.mockRejectedValue(new Error('Git show failed'));

      const content = await gitModule.getHeadVersion('/repo/file.ts');

      expect(content).toBe('');
      // Should not throw, should return empty string
    });

    it('should handle corrupted Git repository', async () => {
      mockGit.revparse.mockRejectedValue(new Error('fatal: not a git repository'));

      const result = await gitModule.initialize('/corrupted/repo');

      expect(result).toBe(false);
    });

    it('should continue operation after Git error', async () => {
      mockGit.revparse.mockResolvedValue('/repo\n');
      await gitModule.initialize('/repo');

      // First call fails
      mockGit.show.mockRejectedValueOnce(new Error('Network error'));
      const content1 = await gitModule.getHeadVersion('/repo/file1.ts');
      expect(content1).toBe('');

      // Second call succeeds
      mockGit.show.mockResolvedValueOnce('file content');
      const content2 = await gitModule.getHeadVersion('/repo/file2.ts');
      expect(content2).toBe('file content');
    });
  });

  describe('File Read Error Handling', () => {
    it('should handle file not found error', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const payload = await diffGenerator.generateDiff('/nonexistent/file.ts', '');

      expect(payload).toBeNull();
      // Should not throw, should return null
    });

    it('should handle file permission denied error', async () => {
      mockFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const payload = await diffGenerator.generateDiff('/no/permission/file.ts', '');

      expect(payload).toBeNull();
    });

    it('should handle file encoding error', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Invalid encoding'));

      const payload = await diffGenerator.generateDiff('/invalid/encoding.ts', '');

      expect(payload).toBeNull();
    });

    it('should handle file read timeout', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read timeout'));

      const payload = await diffGenerator.generateDiff('/timeout/file.ts', '');

      expect(payload).toBeNull();
    });

    it('should handle file deleted during read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File was deleted'));

      const payload = await diffGenerator.generateDiff('/deleted/file.ts', '');

      expect(payload).toBeNull();
    });

    it('should continue operation after file read error', async () => {
      // First call fails - stat succeeds but read fails
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });
      mockFs.readFile.mockRejectedValueOnce(new Error('Read error'));
      const payload1 = await diffGenerator.generateDiff('/error/file1.ts', '');
      expect(payload1).toBeNull();

      // Second call succeeds
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });
      mockFs.readFile.mockResolvedValueOnce(Buffer.from('file content'));
      const payload2 = await diffGenerator.generateDiff('/success/file2.ts', '');
      expect(payload2).not.toBeNull();
      expect(payload2?.modifiedFile).toBe('file content');
    });
  });
});
