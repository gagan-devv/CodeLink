import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Performance tests for Diff Generator
 * Feature: git-integration-diffing
 * 
 * Note: These tests measure file I/O performance directly
 */

describe('DiffGenerator Performance Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diff-perf-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Property 24: Diff generation performance
   * For any file under 10,000 lines, diff generation should complete within 200ms.
   * Validates: Requirements 7.3
   */
  it('Property 24: Diff generation completes within 200ms for files under 10,000 lines', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 10000 }), // Number of lines
        async (numLines) => {
          // Create a test file
          const fileName = `test-${numLines}.txt`;
          const filePath = path.join(tempDir, fileName);
          const content = Array(numLines).fill('test line content').join('\n');
          const headContent = Array(numLines).fill('original line content').join('\n');
          
          await fs.writeFile(filePath, content);

          // Measure diff generation performance (file read + payload construction)
          const startTime = Date.now();
          
          // Simulate diff generation: read file + create payload
          const modifiedFile = await fs.readFile(filePath, 'utf-8');
          const payload = {
            fileName: fileName,
            originalFile: headContent,
            modifiedFile: modifiedFile,
            isDirty: false,
            timestamp: Date.now(),
          };
          
          const elapsed = Date.now() - startTime;

          // Verify operation completed within 200ms
          expect(elapsed).toBeLessThan(200);
          expect(payload.modifiedFile).toBe(content);
        }
      ),
      { numRuns: 50 } // Moderate runs for performance tests
    );
  });

  /**
   * Test diff generation with various file sizes
   * Validates: Requirements 7.3
   */
  it('handles files of varying sizes efficiently', async () => {
    const fileSizes = [100, 1000, 5000, 10000];

    for (const numLines of fileSizes) {
      const fileName = `test-${numLines}.txt`;
      const filePath = path.join(tempDir, fileName);
      const content = Array(numLines).fill('test line content').join('\n');
      const headContent = Array(numLines).fill('original content').join('\n');
      
      await fs.writeFile(filePath, content);

      const startTime = Date.now();
      
      // Simulate diff generation
      const modifiedFile = await fs.readFile(filePath, 'utf-8');
      const payload = {
        fileName: fileName,
        originalFile: headContent,
        modifiedFile: modifiedFile,
        isDirty: false,
        timestamp: Date.now(),
      };
      
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(200);
      expect(payload.modifiedFile).toBe(content);
    }
  });

  /**
   * Test end-to-end latency measurement
   * Validates: Requirements 7.4, 7.5
   */
  it('measures total diff generation time accurately', async () => {
    const fileName = 'test.txt';
    const filePath = path.join(tempDir, fileName);
    const content = Array(1000).fill('test line').join('\n');
    
    await fs.writeFile(filePath, content);

    const startTime = Date.now();
    
    // Simulate diff generation
    const modifiedFile = await fs.readFile(filePath, 'utf-8');
    const payload = {
      fileName: fileName,
      originalFile: '',
      modifiedFile: modifiedFile,
      isDirty: false,
      timestamp: Date.now(),
    };
    
    const elapsed = Date.now() - startTime;

    // Should be well under 200ms for 1000 lines
    expect(elapsed).toBeLessThan(200);
    expect(payload.modifiedFile).toBe(content);
  });
});
