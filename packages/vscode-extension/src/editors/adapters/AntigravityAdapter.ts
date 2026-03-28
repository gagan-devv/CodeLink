import * as vscode from 'vscode';
import {
  IEditorAdapter,
  EditorCapabilities,
  DetectionResult,
  PromptInjectionResult,
} from './types';

/**
 * Adapter for Antigravity extension.
 * 
 * Antigravity is a closed-source AI code editor, so we can only use public commands
 * exposed through VS Code's command API. We cannot read internal state, access
 * chat history, or stream tokens in real-time.
 * 
 * Capabilities:
 * - Prompt injection: Yes (via antigravity.* commands discovered dynamically)
 * - Chat history: No (closed-source, no public API)
 * - Token streaming: No (closed-source, no public API)
 * - Diff artifacts: No (closed-source, no public API)
 * - Prevent auto-apply: No (unknown, depends on Antigravity's internal settings)
 * - Sync level: Control-only
 * 
 * Safety: This adapter uses ONLY public VS Code commands. We never:
 * - Scrape UI elements or webview DOM
 * - Use keystroke replay or automation
 * - Access private or undocumented APIs
 * - Make assumptions about Antigravity's internal state
 * 
 * The mobile client must reconstruct state from other signals (file changes,
 * diff events) rather than relying on chat mirroring.
 */
export class AntigravityAdapter implements IEditorAdapter {
  readonly editorId = 'antigravity';
  readonly editorName = 'Antigravity';
  readonly capabilities: EditorCapabilities = {
    canInjectPrompt: true, // Assuming Antigravity exposes prompt injection commands
    canReadChatHistory: false, // Closed-source: no access to internal state
    canStreamAssistantTokens: false, // Closed-source: no access to streaming
    canReadDiffArtifacts: false, // Closed-source: no public diff API
    canPreventAutoApply: false, // Unknown: depends on Antigravity's settings
    syncLevel: 'control-only', // Can only control, cannot read state
  };

  /**
   * Detect if Antigravity is installed and available.
   * 
   * Uses command discovery pattern: queries all available VS Code commands
   * and looks for Antigravity-specific command patterns (commands starting with
   * "antigravity." or containing "antigravity" in the name).
   * 
   * Safety: Never assumes Antigravity is available. Always checks dynamically
   * using public VS Code API. Fails safe by returning not installed if
   * command query fails.
   * 
   * @returns DetectionResult indicating if Antigravity is installed and available commands
   */
  async detect(): Promise<DetectionResult> {
    try {
      // Query all available commands from VS Code
      const commands = await vscode.commands.getCommands(true);

      // Look for Antigravity-specific commands
      // Antigravity commands typically start with "antigravity." but we also check
      // for commands containing "antigravity" to catch variations
      const antigravityCommands = commands.filter(
        (cmd) => cmd.startsWith('antigravity.') || cmd.toLowerCase().includes('antigravity')
      );

      // Antigravity is installed if we find any antigravity-related commands
      const isInstalled = antigravityCommands.length > 0;

      return {
        isInstalled,
        availableCommands: antigravityCommands,
      };
    } catch (error) {
      // Safety: Fail safe by returning not installed if command query fails
      // This ensures we never assume Antigravity is available when we can't verify
      return {
        isInstalled: false,
        availableCommands: [],
      };
    }
  }

  /**
   * Inject a prompt into Antigravity's chat panel.
   * 
   * Attempts to use Antigravity's public commands to inject a prompt. Since Antigravity
   * is closed-source, we don't know the exact command names, so we try multiple
   * common patterns with fallback logic.
   * 
   * Fallback strategy:
   * 1. Try 'antigravity.chat.send' (common pattern for chat commands)
   * 2. Try 'antigravity.chat.open' with message parameter
   * 3. Try 'antigravity.sendMessage' (alternative pattern)
   * 
   * Safety: Uses only public VS Code commands. Never throws exceptions - always
   * returns error result with clear message if all attempts fail. The actual
   * command names would need to be discovered through Antigravity's documentation
   * or command palette.
   * 
   * Note: The command names used here are educated guesses based on common
   * patterns. In production, these would need to be verified against Antigravity's
   * actual public API.
   * 
   * @param prompt The prompt text to inject into Antigravity's chat
   * @returns PromptInjectionResult indicating success or failure with error details
   */
  async injectPrompt(prompt: string): Promise<PromptInjectionResult> {
    // Try primary command pattern: antigravity.chat.send
    try {
      await vscode.commands.executeCommand('antigravity.chat.send', prompt);

      return {
        success: true,
        commandUsed: 'antigravity.chat.send',
      };
    } catch (primaryError) {
      // Primary command failed, try fallback patterns
      
      // Fallback 1: Try antigravity.chat.open with message parameter
      try {
        await vscode.commands.executeCommand('antigravity.chat.open', {
          message: prompt,
        });

        return {
          success: true,
          commandUsed: 'antigravity.chat.open',
        };
      } catch (fallback1Error) {
        // Fallback 2: Try antigravity.sendMessage
        try {
          await vscode.commands.executeCommand('antigravity.sendMessage', prompt);

          return {
            success: true,
            commandUsed: 'antigravity.sendMessage',
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
              `Failed to inject prompt into Antigravity: ${primaryErrorMessage}. ` +
              `Tried commands: antigravity.chat.send, antigravity.chat.open, antigravity.sendMessage. ` +
              `Antigravity may not be installed or may use different command names.`,
            commandUsed: 'antigravity.chat.send (attempted)',
          };
        }
      }
    }
  }

  // Note: readChatHistory and readDiffArtifacts are NOT implemented
  // because Antigravity is closed-source and does not expose these capabilities.
  // The capabilities object correctly declares these as false.
}
