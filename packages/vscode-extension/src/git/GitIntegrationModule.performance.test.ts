import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import simpleGit, { SimpleGit } from 'simple-git';

/**
 * Performance tests for Git Integration Module
 * Feature: git-integration-diffing
 * 
 * Note: These tests use simple-git directly to avoid VS Code API dependencies
 */

describe('GitIntegrationModule Performance Tests', () => {
  let tempDir: string;
  let git: SimpleGit;

  beforeEach(async () => {
    // Create temporary directory for test repository
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-perf-test-'));
    
    // Initialize Git repository
    git = simpleGit(tempDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Property 23: Git operation performance
   * For any typical file (under 10,000 lines), Git operations should complete within 500ms.
   * Validates: Requirements 7.2
   */
  it('Property 23: Git operations complete within 500ms for typical files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 1000 }), // Number of lines
        async (numLines) => {
          // Create a test file with specified number of lines
          const fileName = `test-${numLines}.txt`;
          const filePath = path.join(tempDir, fileName);
          const content = Array(numLines).fill('test line content').join('\n');
          
          await fs.writeFile(filePath, content);
          
          // Add and commit the file
          await git.add(fileName);
          await git.commit('Add test file');

          // Measure getHeadVersion performance (git show HEAD:file)
          const startTime = Date.now();
          const headContent = await git.show([`HEAD:${fileName}`]);
          const elapsed = Date.now() - startTime;

          // Verify operation completed within 500ms
          expect(elapsed).toBeLessThan(500);
          expect(headContent).toBe(content);
        }
      ),
      { numRuns: 20 } // Reduced runs for performance tests
    );
  });

  /**
   * Test Git operations with large files
   * Validates: Requirements 7.2
   */
  it('handles large files efficiently', async () => {
    // Create a file with 5000 lines
    const fileName = 'large-file.txt';
    const filePath = path.join(tempDir, fileName);
    const content = Array(5000).fill('test line content with some data').join('\n');
    
    await fs.writeFile(filePath, content);
    
    await git.add(fileName);
    await git.commit('Add large file');

    // Measure performance
    const startTime = Date.now();
    const headContent = await git.show([`HEAD:${fileName}`]);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(500);
    expect(headContent.length).toBe(content.length);
  });
});
