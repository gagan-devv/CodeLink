"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitIntegrationModuleImpl = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
const vscode = __importStar(require("vscode"));
class GitIntegrationModuleImpl {
    constructor() {
        this.git = null;
        this.workspaceRoot = '';
        this.repositoryRoot = '';
        this.isInitialized = false;
    }
    async initialize(workspaceRoot) {
        try {
            this.workspaceRoot = workspaceRoot;
            this.git = (0, simple_git_1.default)(workspaceRoot);
            // Find the repository root
            const result = await this.git.revparse(['--show-toplevel']);
            this.repositoryRoot = result.trim();
            this.isInitialized = true;
            console.log(`[GitIntegration] Initialized successfully at ${this.repositoryRoot}`);
            return true;
        }
        catch (error) {
            console.warn('[GitIntegration] Git repository not found:', error);
            this.isInitialized = false;
            return false;
        }
    }
    async getHeadVersion(filePath) {
        if (!this.isInitialized || !this.git) {
            console.warn('[GitIntegration] Not initialized, returning empty HEAD content');
            return '';
        }
        const startTime = Date.now();
        try {
            // Convert absolute path to repository-relative path
            const relativePath = this.getRelativePath(filePath);
            // Fetch HEAD version using git show
            const content = await this.git.show([`HEAD:${relativePath}`]);
            const elapsed = Date.now() - startTime;
            console.log(`[GitIntegration] Fetched HEAD version for ${relativePath} (${content.length} bytes, took ${elapsed}ms)`);
            // Performance warning if Git operation took too long
            if (elapsed > 500) {
                console.warn(`[GitIntegration] Git operation exceeded 500ms threshold: ${elapsed}ms for ${relativePath}`);
            }
            return content;
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            // File is likely untracked or not in HEAD
            // Return empty string to indicate new/untracked file
            console.debug(`[GitIntegration] File not in HEAD (${filePath}, took ${elapsed}ms): ${error}`);
            return '';
        }
    }
    async isTracked(filePath) {
        if (!this.isInitialized || !this.git) {
            return false;
        }
        try {
            const relativePath = this.getRelativePath(filePath);
            // Check if file exists in HEAD
            await this.git.show([`HEAD:${relativePath}`]);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Convert absolute file path to repository-relative path
     * @param filePath - Absolute path to the file
     * @returns Repository-relative path
     */
    getRelativePath(filePath) {
        // Use VS Code's workspace API to get relative path
        const relativePath = vscode.workspace.asRelativePath(filePath, false);
        // Normalize path separators for Git (always use forward slashes)
        return relativePath.replace(/\\/g, '/');
    }
}
exports.GitIntegrationModuleImpl = GitIntegrationModuleImpl;
//# sourceMappingURL=GitIntegrationModule.js.map