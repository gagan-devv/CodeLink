import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { FileContextPayload } from '@codelink/protocol';

/**
 * Diff Generator
 * Compares HEAD version vs current file state and prepares payload
 */
export interface DiffGenerator {
  /**
   * Generate diff data for a file
   * @param filePath - Absolute path to the file
   * @param headContent - Content from Git HEAD (empty if untracked)
   * @returns FileContextPayload or null if error occurs
   */
  generateDiff(filePath: string, headContent: string): Promise<FileContextPayload | null>;
}

// File size threshold: 1MB
const FILE_SIZE_WARNING_THRESHOLD = 1024 * 1024; // 1MB in bytes
const FILE_SIZE_MAX_THRESHOLD = 10 * 1024 * 1024; // 10MB in bytes

export class DiffGeneratorImpl implements DiffGenerator {
  async generateDiff(filePath: string, headContent: string): Promise<FileContextPayload | null> {
    const startTime = Date.now();
    
    try {
      // Validate file path
      if (!filePath || filePath.trim().length === 0) {
        console.warn(`[DiffGenerator] Invalid file path: empty or whitespace-only`);
        return null;
      }
      
      // Check file size before reading
      const fileStats = await this.getFileStats(filePath);
      
      if (fileStats.size > FILE_SIZE_MAX_THRESHOLD) {
        console.warn(
          `[DiffGenerator] File too large (${this.formatBytes(fileStats.size)}), skipping: ${filePath}`
        );
        return null;
      }
      
      if (fileStats.size > FILE_SIZE_WARNING_THRESHOLD) {
        console.warn(
          `[DiffGenerator] Large file detected (${this.formatBytes(fileStats.size)}): ${filePath}`
        );
      }
      
      // Read current file content from disk
      const modifiedFile = await this.readFileContent(filePath);
      
      // Get workspace-relative path for fileName
      const fileName = vscode.workspace.asRelativePath(filePath, false);
      
      // Check if file has unsaved changes
      const isDirty = this.isFileDirty(filePath);
      
      // Generate timestamp
      const timestamp = Date.now();
      
      // Construct FileContextPayload
      const payload: FileContextPayload = {
        fileName,
        originalFile: headContent,
        modifiedFile,
        isDirty,
        timestamp,
      };
      
      const elapsed = Date.now() - startTime;
      console.log(
        `[DiffGenerator] Generated diff for ${fileName} (${this.formatBytes(modifiedFile.length)} bytes, isDirty: ${isDirty}, took ${elapsed}ms)`
      );
      
      // Performance warning if diff generation took too long
      if (elapsed > 200) {
        console.warn(
          `[DiffGenerator] Diff generation exceeded 200ms threshold: ${elapsed}ms for ${fileName}`
        );
      }
      
      return payload;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[DiffGenerator] Error generating diff for ${filePath} (took ${elapsed}ms):`, error);
      return null;
    }
  }

  /**
   * Get file statistics
   * @param filePath - Absolute path to the file
   * @returns File stats including size
   */
  private async getFileStats(filePath: string): Promise<{ size: number }> {
    try {
      const stats = await fs.stat(filePath);
      return { size: stats.size };
    } catch (error) {
      console.error(`[DiffGenerator] Error getting file stats ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Format bytes to human-readable string
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Read file content from disk
   * @param filePath - Absolute path to the file
   * @returns File content as string
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer.toString('utf-8');
    } catch (error) {
      console.error(`[DiffGenerator] Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Check if file has unsaved changes in the editor
   * @param filePath - Absolute path to the file
   * @returns true if file has unsaved changes, false otherwise
   */
  private isFileDirty(filePath: string): boolean {
    // Find the document in VS Code's open documents
    const document = vscode.workspace.textDocuments.find(
      doc => doc.uri.fsPath === filePath
    );
    
    // If document is open, check its dirty state
    if (document) {
      return document.isDirty;
    }
    
    // If document is not open, it's not dirty
    return false;
  }
}
