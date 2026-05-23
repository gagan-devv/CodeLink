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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinueAdapter = void 0;
const vscode = __importStar(require("vscode"));
class ContinueAdapter {
    constructor() {
        this.editorId = 'continue';
        this.editorName = 'Continue';
        this.capabilities = {
            canInjectPrompt: true,
            canReadChatHistory: true,
            canStreamAssistantTokens: true,
            canReadDiffArtifacts: true,
            canPreventAutoApply: true,
            syncLevel: 'full',
        };
    }
    async detect() {
        try {
            const commands = await vscode.commands.getCommands(true);
            const continueCommands = commands.filter((cmd) => cmd.startsWith('continue.'));
            const isInstalled = continueCommands.length > 0;
            return {
                isInstalled,
                availableCommands: continueCommands,
            };
        }
        catch (error) {
            // Safety: Fail safe by returning not installed
            return {
                isInstalled: false,
                availableCommands: [],
            };
        }
    }
    async injectPrompt(prompt) {
        try {
            await vscode.commands.executeCommand('continue.continueGUIView.focusContinueInput', {
                text: prompt,
            });
            return {
                success: true,
                commandUsed: 'continue.continueGUIView.focusContinueInput',
            };
        }
        catch (error) {
            // Safety: Never throw, always return error result with context
            // Handle any type of error safely, including objects with malformed toString
            let errorMessage;
            try {
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else if (typeof error === 'string') {
                    errorMessage = error;
                }
                else if (error && typeof error === 'object') {
                    // Safely handle objects that might have broken toString
                    errorMessage = JSON.stringify(error);
                }
                else {
                    errorMessage = String(error);
                }
            }
            catch {
                // If even JSON.stringify fails, use a fallback
                errorMessage = 'Unknown error occurred';
            }
            return {
                success: false,
                error: `Failed to inject prompt into Continue: ${errorMessage}`,
                commandUsed: 'continue.continueGUIView.focusContinueInput',
            };
        }
    }
    async readChatHistory() {
        // Implementation would access Continue's internal state
        // This is allowed because Continue is open-source
        // Actual implementation depends on Continue's API
        throw new Error('readChatHistory not yet implemented for Continue adapter');
    }
    /**
     * Read diff artifacts from Continue.
     *
     * Note: This method is declared because Continue supports reading diffs
     * (it's open-source and exposes diff state). However, the actual implementation
     * depends on Continue's specific API for accessing diff artifacts.
     *
     * Safety: Only reads diffs when Continue provides public access.
     *
     * @returns Array of diff artifacts
     * @throws Error indicating not yet implemented
     */
    async readDiffArtifacts() {
        // Implementation would access Continue's diff state
        // This is allowed because Continue is open-source
        throw new Error('readDiffArtifacts not yet implemented for Continue adapter');
    }
}
exports.ContinueAdapter = ContinueAdapter;
//# sourceMappingURL=ContinueAdapter.js.map