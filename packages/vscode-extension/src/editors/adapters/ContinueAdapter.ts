import * as vscode from 'vscode';
import {
  IEditorAdapter,
  EditorCapabilities,
  DetectionResult,
  PromptInjectionResult,
  ChatMessage,
  DiffArtifact,
} from './types';

export class ContinueAdapter implements IEditorAdapter {
  readonly editorId = 'continue';
  readonly editorName = 'Continue';
  readonly capabilities: EditorCapabilities = {
    canInjectPrompt: true,
    canReadChatHistory: true,
    canStreamAssistantTokens: true,
    canReadDiffArtifacts: true,
    canPreventAutoApply: true,
    syncLevel: 'full',
  };

  async detect(): Promise<DetectionResult> {
    try {
      const commands = await vscode.commands.getCommands(true);

      const continueCommands = commands.filter((cmd) =>
        cmd.startsWith('continue.')
      );

      const isInstalled = continueCommands.length > 0;

      return {
        isInstalled,
        availableCommands: continueCommands,
      };
    } catch (error) {
      // Safety: Fail safe by returning not installed
      return {
        isInstalled: false,
        availableCommands: [],
      };
    }
  }

  async injectPrompt(prompt: string): Promise<PromptInjectionResult> {
    try {
      await vscode.commands.executeCommand(
        'continue.continueGUIView.focusContinueInput',
        { text: prompt }
      );

      return {
        success: true,
        commandUsed: 'continue.continueGUIView.focusContinueInput',
      };
    } catch (error) {
      // Safety: Never throw, always return error result with context
      // Handle any type of error safely, including objects with malformed toString
      let errorMessage: string;
      try {
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          // Safely handle objects that might have broken toString
          errorMessage = JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
      } catch {
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

  async readChatHistory(): Promise<ChatMessage[]> {
    // Implementation would access Continue's internal state
    // This is allowed because Continue is open-source
    // Actual implementation depends on Continue's API
    throw new Error(
      'readChatHistory not yet implemented for Continue adapter'
    );
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
  async readDiffArtifacts(): Promise<DiffArtifact[]> {
    // Implementation would access Continue's diff state
    // This is allowed because Continue is open-source
    throw new Error(
      'readDiffArtifacts not yet implemented for Continue adapter'
    );
  }
}
