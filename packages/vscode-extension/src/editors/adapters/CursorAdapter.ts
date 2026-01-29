import * as vscode from 'vscode';
import {
  IEditorAdapter,
  EditorCapabilities,
  DetectionResult,
  PromptInjectionResult,
} from './types';

/**
 * Adapter for Cursor extension.
 * 
 * Cursor is a closed-source AI code editor, so we can only use public commands
 * exposed through VS Code's command API. We cannot read internal state, access
 * chat history, or stream tokens in real-time.
 * 
 * Capabilities:
 * - Prompt injection: Yes (via cursor.* commands discovered dynamically)
 * - Chat history: No (closed-source, no public API)
 * - Token streaming: No (closed-source, no public API)
 * - Diff artifacts: No (closed-source, no public API)
 * - Prevent auto-apply: No (unknown, depends on Cursor's internal settings)
 * - Sync level: Control-only
 * 
 * Safety: This adapter uses ONLY public VS Code commands. We never:
 * - Scrape UI elements or webview DOM
 * - Use keystroke replay or automation
 * - Access private or undocumented APIs
 * - Make assumptions about Cursor's internal state
 * 
 * The mobile client must reconstruct state from other signals (file changes,
 * diff events) rather than relying on chat mirroring.
 */
export class CursorAdapter implements IEditorAdapter {
  readonly editorId = 'cursor';
  readonly editorName = 'Cursor';
  readonly capabilities: EditorCapabilities = {
    canInjectPrompt: true, // Assuming Cursor exposes prompt injection commands
    canReadChatHistory: false, // Closed-source: no access to internal state
    canStreamAssistantTokens: false, // Closed-source: no access to streaming
    canReadDiffArtifacts: false, // Closed-source: no public diff API
    canPreventAutoApply: false, // Unknown: depends on Cursor's settings
    syncLevel: 'control-only', // Can only control, cannot read state
  };

  /**
   * Detect if Cursor is installed and available.
   * 
   * Uses command discovery pattern: queries all available VS Code commands
   * and looks for Cursor-specific command patterns (commands starting with
   * "cursor." or containing "cursor" in the name).
   * 
   * Safety: Never assumes Cursor is available. Always checks dynamically
   * using public VS Code API. Fails safe by returning not installed if
   * command query fails.
   * 
   * @returns DetectionResult indicating if Cursor is installed and available commands
   */
  async detect(): Promise<DetectionResult> {
    try {
      // Query all available commands from VS Code
      const commands = await vscode.commands.getCommands(true);

      // Look for Cursor-specific commands
      // Cursor commands typically start with "cursor." but we also check
      // for commands containing "cursor" to catch variations
      const cursorCommands = commands.filter(
        (cmd) => cmd.startsWith('cursor.') || cmd.toLowerCase().includes('cursor')
      );

      // Cursor is installed if we find any cursor-related commands
      const isInstalled = cursorCommands.length > 0;

      return {
        isInstalled,
        availableCommands: cursorCommands,
      };
    } catch (error) {
      // Safety: Fail safe by returning not installed if command query fails
      // This ensures we never assume Cursor is available when we can't verify
      return {
        isInstalled: false,
        availableCommands: [],
      };
    }
  }

  /**
   * Inject a prompt into Cursor's chat panel.
   * 
   * Attempts to use Cursor's public commands to inject a prompt. Since Cursor
   * is closed-source, we don't know the exact command names, so we try multiple
   * common patterns with fallback logic.
   * 
   * Fallback strategy:
   * 1. Try 'cursor.chat.newMessage' (common pattern for chat commands)
   * 2. Try 'cursor.openChat' with message parameter
   * 3. Try 'cursor.sendMessage' (alternative pattern)
   * 
   * Safety: Uses only public VS Code commands. Never throws exceptions - always
   * returns error result with clear message if all attempts fail. The actual
   * command names would need to be discovered through Cursor's documentation
   * or command palette.
   * 
   * Note: The command names used here are educated guesses based on common
   * patterns. In production, these would need to be verified against Cursor's
   * actual public API.
   * 
   * @param prompt The prompt text to inject into Cursor's chat
   * @returns PromptInjectionResult indicating success or failure with error details
   */
  async injectPrompt(prompt: string): Promise<PromptInjectionResult> {
    // Try primary command pattern: cursor.chat.newMessage
    try {
      await vscode.commands.executeCommand('cursor.chat.newMessage', prompt);

      return {
        success: true,
        commandUsed: 'cursor.chat.newMessage',
      };
    } catch (primaryError) {
      // Primary command failed, try fallback patterns
      
      // Fallback 1: Try cursor.openChat with message parameter
      try {
        await vscode.commands.executeCommand('cursor.openChat', {
          message: prompt,
        });

        return {
          success: true,
          commandUsed: 'cursor.openChat',
        };
      } catch (fallback1Error) {
        // Fallback 2: Try cursor.sendMessage
        try {
          await vscode.commands.executeCommand('cursor.sendMessage', prompt);

          return {
            success: true,
            commandUsed: 'cursor.sendMessage',
          };
        } catch (fallback2Error) {
          // All attempts failed - return error result with context
          // Safety: Never throw, always return error result
          const primaryErrorMessage =
            primaryError instanceof Error
              ? primaryError.message
              : String(primaryError);

          return {
            success: false,
            error:
              `Failed to inject prompt into Cursor: ${primaryErrorMessage}. ` +
              `Tried commands: cursor.chat.newMessage, cursor.openChat, cursor.sendMessage. ` +
              `Cursor may not be installed or may use different command names.`,
            commandUsed: 'cursor.chat.newMessage (attempted)',
          };
        }
      }
    }
  }

  // Note: readChatHistory and readDiffArtifacts are NOT implemented
  // because Cursor is closed-source and does not expose these capabilities.
  // The capabilities object correctly declares these as false.
}
