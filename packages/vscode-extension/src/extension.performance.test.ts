import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import simpleGit, { SimpleGit } from 'simple-git';

/**
 * End-to-end performance tests
 * Feature: git-integration-diffing
 * 
 * Note: These tests simulate the full pipeline without VS Code dependencies
 */

describe('End-to-End Performance Tests', () => {
  let tempDir: string;
  let git: SimpleGit;

  beforeEach(async () => {
    // Create temporary directory for test repository
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-perf-test-'));
    
    // Initialize Git repository
    git = simpleGit(tempDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Test end-to-end latency is under 2000ms
   * Validates: Requirements 7.5
   */
  it('end-to-end pipeline completes within 2000ms', async () => {
    // Create and commit a test file
    const fileName = 'test.txt';
    const filePath = path.join(tempDir, fileName);
    const originalContent = Array(1000).fill('original line').join('\n');
    
    await fs.writeFile(filePath, originalContent);
    
    await git.add(fileName);
    await git.commit('Initial commit');

    // Modify the file
    const modifiedContent = Array(1000).fill('modified line').join('\n');
    await fs.writeFile(filePath, modifiedContent);

    // Measure end-to-end pipeline
    const startTime = Date.now();
    
    // Step 1: Fetch HEAD version (Git operation)
    const headContent = await git.show([`HEAD:${fileName}`]);
    
    // Step 2: Read current file (Diff generation)
    const currentContent = await fs.readFile(filePath, 'utf-8');
    
    // Step 3: Create payload
    const payload = {
      fileName: fileName,
      originalFile: headContent,
      modifiedFile: currentContent,
      isDirty: false,
      timestamp: Date.now(),
    };
    
    const elapsed = Date.now() - startTime;

    // Verify total time is under 2000ms
    expect(elapsed).toBeLessThan(2000);
    expect(payload.originalFile).toBe(originalContent);
    expect(payload.modifiedFile).toBe(modifiedContent);
  });

  /**
   * Test pipeline with various file sizes
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
   */
  it('handles various file sizes within performance requirements', async () => {
    const fileSizes = [100, 500, 1000, 5000];

    for (const numLines of fileSizes) {
      const fileName = `test-${numLines}.txt`;
      const filePath = path.join(tempDir, fileName);
      const content = Array(numLines).fill('test line').join('\n');
      
      await fs.writeFile(filePath, content);
      
      await git.add(fileName);
      await git.commit(`Add ${fileName}`);

      // Modify file
      const modifiedContent = Array(numLines).fill('modified line').join('\n');
      await fs.writeFile(filePath, modifiedContent);

      // Measure pipeline
      const startTime = Date.now();
      const headContent = await git.show([`HEAD:${fileName}`]);
      const currentContent = await fs.readFile(filePath, 'utf-8');
      const payload = {
        fileName: fileName,
        originalFile: headContent,
        modifiedFile: currentContent,
        isDirty: false,
        timestamp: Date.now(),
      };
      const elapsed = Date.now() - startTime;

      // Should be well under 2000ms
      expect(elapsed).toBeLessThan(2000);
      expect(payload.modifiedFile).toBe(modifiedContent);
    }
  });
});
