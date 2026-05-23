import { IEditorAdapter, EditorCapabilities, DetectionResult, PromptInjectionResult } from './types';
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
export declare class CursorAdapter implements IEditorAdapter {
    readonly editorId = "cursor";
    readonly editorName = "Cursor";
    readonly capabilities: EditorCapabilities;
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
    detect(): Promise<DetectionResult>;
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
    injectPrompt(prompt: string): Promise<PromptInjectionResult>;
}
//# sourceMappingURL=CursorAdapter.d.ts.map