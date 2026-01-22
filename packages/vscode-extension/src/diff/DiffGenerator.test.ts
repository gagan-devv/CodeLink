import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffGeneratorImpl } from './DiffGenerator';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    asRelativePath: vi.fn((path: string) => {
      // Extract relative path from absolute path
      const parts = path.split('/');
      const projectIndex = parts.indexOf('project');
      if (projectIndex >= 0 && projectIndex < parts.length - 1) {
        return parts.slice(projectIndex + 1).join('/');
      }
      return parts[parts.length - 1];
    }),
    textDocuments: [],
  },
}));

// Mock fs/promises module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

describe('DiffGenerator', () => {
  let diffGenerator: DiffGeneratorImpl;

  beforeEach(() => {
    diffGenerator = new DiffGeneratorImpl();
    vi.clearAllMocks();
  });

  describe('generateDiff', () => {
    it('should read current file content correctly', async () => {
      const filePath = '/home/user/project/src/index.ts';
      const headContent = 'const x = 1;';
      const currentContent = 'const x = 2;';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result?.modifiedFile).toBe(currentContent);
      expect(result?.originalFile).toBe(headContent);
    });

    it('should set isDirty flag correctly for unsaved files', async () => {
      const filePath = '/home/user/project/src/dirty.ts';
      const headContent = 'old content';
      const currentContent = 'new content';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      // Mock open document with isDirty = true
      const mockDocument = {
        uri: { fsPath: filePath },
        isDirty: true,
      };
      (vscode.workspace as any).textDocuments = [mockDocument];

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result?.isDirty).toBe(true);
    });

    it('should set isDirty flag to false for saved files', async () => {
      const filePath = '/home/user/project/src/saved.ts';
      const headContent = 'content';
      const currentContent = 'content';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      // Mock open document with isDirty = false
      const mockDocument = {
        uri: { fsPath: filePath },
        isDirty: false,
      };
      (vscode.workspace as any).textDocuments = [mockDocument];

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result?.isDirty).toBe(false);
    });

    it('should generate FileContextPayload structure correctly', async () => {
      const filePath = '/home/user/project/src/test.ts';
      const headContent = 'original';
      const currentContent = 'modified';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('originalFile');
      expect(result).toHaveProperty('modifiedFile');
      expect(result).toHaveProperty('isDirty');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result?.timestamp).toBe('number');
    });

    it('should generate workspace-relative path correctly', async () => {
      const filePath = '/home/user/project/src/components/Button.tsx';
      const headContent = '';
      const currentContent = 'button code';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      // Mock asRelativePath to return proper relative path
      (vscode.workspace.asRelativePath as any).mockReturnValue('src/components/Button.tsx');

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result?.fileName).toBe('src/components/Button.tsx');
    });

    it('should handle file read errors gracefully', async () => {
      const filePath = '/home/user/project/src/missing.ts';
      const headContent = 'content';

      // Mock file stat to throw error
      (fs.stat as any).mockRejectedValue(new Error('File not found'));

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).toBeNull();
    });

    it('should generate accurate timestamp', async () => {
      const filePath = '/home/user/project/src/test.ts';
      const headContent = 'content';
      const currentContent = 'content';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      const beforeTime = Date.now();
      const result = await diffGenerator.generateDiff(filePath, headContent);
      const afterTime = Date.now();

      expect(result).not.toBeNull();
      expect(result?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result?.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle empty head content for untracked files', async () => {
      const filePath = '/home/user/project/src/newfile.ts';
      const headContent = '';
      const currentContent = 'new file content';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result?.originalFile).toBe('');
      expect(result?.modifiedFile).toBe(currentContent);
    });

    it('should handle identical files correctly', async () => {
      const filePath = '/home/user/project/src/unchanged.ts';
      const content = 'unchanged content';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: content.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(content));

      const result = await diffGenerator.generateDiff(filePath, content);

      expect(result).not.toBeNull();
      expect(result?.originalFile).toBe(content);
      expect(result?.modifiedFile).toBe(content);
    });

    it('should return false for isDirty when file is not open', async () => {
      const filePath = '/home/user/project/src/closed.ts';
      const headContent = 'content';
      const currentContent = 'content';

      // Mock file stat and read
      (fs.stat as any).mockResolvedValue({ size: currentContent.length });
      (fs.readFile as any).mockResolvedValue(Buffer.from(currentContent));

      // No documents open
      (vscode.workspace as any).textDocuments = [];

      const result = await diffGenerator.generateDiff(filePath, headContent);

      expect(result).not.toBeNull();
      expect(result?.isDirty).toBe(false);
    });
  });
});
