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
export declare class GitIntegrationModuleImpl implements GitIntegrationModule {
    private git;
    private workspaceRoot;
    private repositoryRoot;
    private isInitialized;
    initialize(workspaceRoot: string): Promise<boolean>;
    getHeadVersion(filePath: string): Promise<string>;
    isTracked(filePath: string): Promise<boolean>;
    /**
     * Convert absolute file path to repository-relative path
     * @param filePath - Absolute path to the file
     * @returns Repository-relative path
     */
    private getRelativePath;
}
//# sourceMappingURL=GitIntegrationModule.d.ts.map