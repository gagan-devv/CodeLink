import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DiffGeneratorImpl } from './DiffGenerator';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    asRelativePath: vi.fn((path: string) => {
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

describe('DiffGenerator - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Feature: git-integration-diffing, Property 7: File content reading
  it('Property 7: For any file path, DiffGenerator reads current file content or handles errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // file content
        fc.string({ minLength: 0, maxLength: 200 }), // head content
        async (fileName, fileContent, headContent) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock successful file stat and read
          (fs.stat as any).mockResolvedValue({ size: fileContent.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(fileContent));
          (vscode.workspace as any).textDocuments = [];
          
          const result = await diffGenerator.generateDiff(filePath, headContent);
          
          // Should successfully generate payload
          expect(result).not.toBeNull();
          expect(result?.modifiedFile).toBe(fileContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: git-integration-diffing, Property 8: Diff computation
  it('Property 8: For any file with HEAD and current versions, DiffGenerator produces FileContextPayload', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // original content
        fc.string({ minLength: 0, maxLength: 200 }), // modified content
        async (fileName, originalFile, modifiedFile) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read
          (fs.stat as any).mockResolvedValue({ size: modifiedFile.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(modifiedFile));
          (vscode.workspace as any).textDocuments = [];
          
          const result = await diffGenerator.generateDiff(filePath, originalFile);
          
          // Should contain both versions
          expect(result).not.toBeNull();
          expect(result?.originalFile).toBe(originalFile);
          expect(result?.modifiedFile).toBe(modifiedFile);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: git-integration-diffing, Property 9: Untracked file representation
  it('Property 9: For any untracked file (empty originalFile), payload contains full current content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 1, maxLength: 200 }), // modified content
        async (fileName, modifiedFile) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read
          (fs.stat as any).mockResolvedValue({ size: modifiedFile.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(modifiedFile));
          (vscode.workspace as any).textDocuments = [];
          
          // Empty head content (untracked file)
          const result = await diffGenerator.generateDiff(filePath, '');
          
          // Should have empty original and full modified
          expect(result).not.toBeNull();
          expect(result?.originalFile).toBe('');
          expect(result?.modifiedFile).toBe(modifiedFile);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: git-integration-diffing, Property 10: No-change detection
  it('Property 10: For any file where HEAD equals current, originalFile equals modifiedFile', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // content
        async (fileName, content) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read with same content
          (fs.stat as any).mockResolvedValue({ size: content.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(content));
          (vscode.workspace as any).textDocuments = [];
          
          const result = await diffGenerator.generateDiff(filePath, content);
          
          // Should have identical content
          expect(result).not.toBeNull();
          expect(result?.originalFile).toBe(result?.modifiedFile);
          expect(result?.originalFile).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: git-integration-diffing, Property 11: Content preservation
  it('Property 11: For any file, payload contains exact original and modified content without mutations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // original content
        fc.string({ minLength: 0, maxLength: 200 }), // modified content
        async (fileName, originalFile, modifiedFile) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read
          (fs.stat as any).mockResolvedValue({ size: modifiedFile.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(modifiedFile));
          (vscode.workspace as any).textDocuments = [];
          
          const result = await diffGenerator.generateDiff(filePath, originalFile);
          
          // Content should be preserved exactly
          expect(result).not.toBeNull();
          expect(result?.originalFile).toBe(originalFile);
          expect(result?.modifiedFile).toBe(modifiedFile);
          
          // Verify no transformations occurred
          expect(result?.originalFile.length).toBe(originalFile.length);
          expect(result?.modifiedFile.length).toBe(modifiedFile.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: isDirty flag accuracy
  it('Property 19: For any file with unsaved changes, isDirty is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // content
        async (fileName, content) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read
          (fs.stat as any).mockResolvedValue({ size: content.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(content));
          
          // Mock document with isDirty = true
          const mockDocument = {
            uri: { fsPath: filePath },
            isDirty: true,
          };
          (vscode.workspace as any).textDocuments = [mockDocument];
          
          const result = await diffGenerator.generateDiff(filePath, '');
          
          // Should have isDirty = true
          expect(result).not.toBeNull();
          expect(result?.isDirty).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: isDirty flag accuracy for saved files
  it('Property 20: For any file that is saved, isDirty is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // content
        async (fileName, content) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read
          (fs.stat as any).mockResolvedValue({ size: content.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(content));
          
          // Mock document with isDirty = false
          const mockDocument = {
            uri: { fsPath: filePath },
            isDirty: false,
          };
          (vscode.workspace as any).textDocuments = [mockDocument];
          
          const result = await diffGenerator.generateDiff(filePath, content);
          
          // Should have isDirty = false
          expect(result).not.toBeNull();
          expect(result?.isDirty).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Timestamp accuracy
  it('Property 21: For any generated payload, timestamp reflects generation time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // content
        async (fileName, content) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat and read
          (fs.stat as any).mockResolvedValue({ size: content.length });
          (fs.readFile as any).mockResolvedValue(Buffer.from(content));
          (vscode.workspace as any).textDocuments = [];
          
          const beforeTime = Date.now();
          const result = await diffGenerator.generateDiff(filePath, content);
          const afterTime = Date.now();
          
          // Timestamp should be within reasonable range
          expect(result).not.toBeNull();
          expect(result?.timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(result?.timestamp).toBeLessThanOrEqual(afterTime + 100); // Allow 100ms tolerance
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Error handling
  it('Property: For any file read error, generateDiff returns null without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // file name (non-whitespace)
        fc.string({ minLength: 0, maxLength: 200 }), // head content
        async (fileName, headContent) => {
          const diffGenerator = new DiffGeneratorImpl();
          const filePath = `/home/user/project/${fileName}`;
          
          // Mock file stat to throw error
          (fs.stat as any).mockRejectedValue(new Error('File read error'));
          
          // Should not throw, should return null
          const result = await diffGenerator.generateDiff(filePath, headContent);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
