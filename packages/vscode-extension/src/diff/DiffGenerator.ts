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

export class DiffGeneratorImpl implements DiffGenerator {
  async generateDiff(filePath: string, headContent: string): Promise<FileContextPayload | null> {
    try {
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
      
      console.log(`[DiffGenerator] Generated diff for ${fileName} (${modifiedFile.length} bytes, isDirty: ${isDirty})`);
      return payload;
    } catch (error) {
      console.error(`[DiffGenerator] Error generating diff for ${filePath}:`, error);
      return null;
    }
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
