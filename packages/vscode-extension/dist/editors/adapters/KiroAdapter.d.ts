import { IEditorAdapter, EditorCapabilities, DetectionResult, PromptInjectionResult, ChatMessage, DiffArtifact } from './types';
/**
 * Adapter for Kiro extension.
 *
 * Since we ARE Kiro, we have internal access to our own state and capabilities.
 * However, this adapter uses public command patterns where possible to demonstrate
 * the adapter pattern for other editors.
 *
 * Capabilities:
 * - Prompt injection: Yes (we control our own chat interface)
 * - Chat history: Yes (we control our own state)
 * - Token streaming: Yes (we control our own streaming)
 * - Diff artifacts: Yes (we control our own diffs)
 * - Prevent auto-apply: Yes (we control edit application)
 * - Sync level: Partial (we have full internal access but use partial for consistency)
 *
 * Safety: Uses public VS Code commands where available. Since we are Kiro,
 * we can safely access internal state when needed, but we prefer command-based
 * interaction to maintain consistency with other adapters.
 */
export declare class KiroAdapter implements IEditorAdapter {
    readonly editorId = "kiro";
    readonly editorName = "Kiro";
    readonly capabilities: EditorCapabilities;
    /**
     * Detect if Kiro is available.
     *
     * Since we ARE Kiro, this always returns installed. However, we still
     * query for Kiro commands to maintain consistency with other adapters
     * and to provide useful debugging information.
     *
     * Safety: Always returns installed since we are running as Kiro.
     * Command discovery is used for informational purposes only.
     */
    detect(): Promise<DetectionResult>;
    /**
     * Inject a prompt into Kiro's chat panel.
     *
     * Uses Kiro's public command to send a message to the chat interface.
     * The command name follows the pattern used by other AI editors.
     *
     * Safety: Uses public VS Code command API. Falls back gracefully if
     * the command doesn't exist or fails to execute.
     *
     * @param prompt The prompt text to inject
     * @returns Result indicating success or failure with error details
     */
    injectPrompt(prompt: string): Promise<PromptInjectionResult>;
    /**
     * Read chat history from Kiro.
     *
     * Since we ARE Kiro, we can access our internal chat state directly.
     * This method would integrate with Kiro's chat history storage.
     *
     * Safety: Only reads our own internal state. No external API access required.
     *
     * @returns Array of chat messages
     * @throws Error indicating not yet implemented
     */
    readChatHistory(): Promise<ChatMessage[]>;
    /**
     * Read diff artifacts from Kiro.
     *
     * Since we ARE Kiro, we can access our internal diff state directly.
     * This method would integrate with Kiro's diff tracking system.
     *
     * Safety: Only reads our own internal state. No external API access required.
     *
     * @returns Array of diff artifacts
     * @throws Error indicating not yet implemented
     */
    readDiffArtifacts(): Promise<DiffArtifact[]>;
}
//# sourceMappingURL=KiroAdapter.d.ts.map