import { IEditorAdapter, EditorCapabilities, DetectionResult, PromptInjectionResult, ChatMessage, DiffArtifact } from './types';
export declare class ContinueAdapter implements IEditorAdapter {
    readonly editorId = "continue";
    readonly editorName = "Continue";
    readonly capabilities: EditorCapabilities;
    detect(): Promise<DetectionResult>;
    injectPrompt(prompt: string): Promise<PromptInjectionResult>;
    readChatHistory(): Promise<ChatMessage[]>;
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
    readDiffArtifacts(): Promise<DiffArtifact[]>;
}
//# sourceMappingURL=ContinueAdapter.d.ts.map