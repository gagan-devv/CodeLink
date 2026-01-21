import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';

/**
 * Git Integration Module
 * Handles Git operations for fetching HEAD versions of files
 */
export interface GitIntegrationModule {
  /**
   * Initialize and locate the Git repository
   * @param workspaceRoot - The workspace root directory
   * @returns true if Git repository found, false otherwise
   */
  initialize(workspaceRoot: string): Promise<boolean>;

  /**
   * Fetch the HEAD version of a file
   * Returns empty string if file is untracked or Git operation fails
   * @param filePath - Absolute path to the file
   * @returns Content from HEAD or empty string
   */
  getHeadVersion(filePath: string): Promise<string>;

  /**
   * Check if a file is tracked by Git
   * @param filePath - Absolute path to the file
   * @returns true if tracked, false otherwise
   */
  isTracked(filePath: string): Promise<boolean>;
}

export class GitIntegrationModuleImpl implements GitIntegrationModule {
  private git: SimpleGit | null = null;
  private workspaceRoot: string = '';
  private repositoryRoot: string = '';
  private isInitialized: boolean = false;

  async initialize(workspaceRoot: string): Promise<boolean> {
    try {
      this.workspaceRoot = workspaceRoot;
      this.git = simpleGit(workspaceRoot);

      // Find the repository root
      const result = await this.git.revparse(['--show-toplevel']);
      this.repositoryRoot = result.trim();
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.warn('Git repository not found:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async getHeadVersion(filePath: string): Promise<string> {
    if (!this.isInitialized || !this.git) {
      return '';
    }

    try {
      // Convert absolute path to repository-relative path
      const relativePath = this.getRelativePath(filePath);
      
      // Fetch HEAD version using git show
      const content = await this.git.show([`HEAD:${relativePath}`]);
      return content;
    } catch (error) {
      // File is likely untracked or not in HEAD
      // Return empty string to indicate new/untracked file
      return '';
    }
  }

  async isTracked(filePath: string): Promise<boolean> {
    if (!this.isInitialized || !this.git) {
      return false;
    }

    try {
      const relativePath = this.getRelativePath(filePath);
      
      // Check if file exists in HEAD
      await this.git.show([`HEAD:${relativePath}`]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert absolute file path to repository-relative path
   * @param filePath - Absolute path to the file
   * @returns Repository-relative path
   */
  private getRelativePath(filePath: string): string {
    // Use VS Code's workspace API to get relative path
    const relativePath = vscode.workspace.asRelativePath(filePath, false);
    
    // Normalize path separators for Git (always use forward slashes)
    return relativePath.replace(/\\/g, '/');
  }
}
