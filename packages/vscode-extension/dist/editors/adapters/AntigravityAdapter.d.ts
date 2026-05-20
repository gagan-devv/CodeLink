import { IEditorAdapter, EditorCapabilities, DetectionResult, PromptInjectionResult } from './types';
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
export declare class AntigravityAdapter implements IEditorAdapter {
    readonly editorId = "antigravity";
    readonly editorName = "Antigravity";
    readonly capabilities: EditorCapabilities;
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
    detect(): Promise<DetectionResult>;
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
    injectPrompt(prompt: string): Promise<PromptInjectionResult>;
}
//# sourceMappingURL=AntigravityAdapter.d.ts.map