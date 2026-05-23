import { IEditorAdapter, DetectionResult } from './types';
/**
 * Registry for managing editor adapters.
 *
 * Responsibilities:
 * - Register adapters at extension activation
 * - Detect available editors
 * - Select best adapter based on capabilities
 * - Provide query interface
 *
 * Safety: Registry never assumes an editor is available. All operations
 * check adapter capabilities before attempting operations.
 */
export declare class EditorRegistry {
    private adapters;
    private detectionCache;
    /**
     * Register an editor adapter.
     *
     * Called during extension activation to register all known adapters.
     */
    register(adapter: IEditorAdapter): void;
    /**
     * Detect all available editors.
     *
     * Returns map of editorId -> DetectionResult.
     * Results are cached to avoid repeated command queries.
     */
    detectAll(): Promise<Map<string, DetectionResult>>;
    /**
     * Get the best available adapter based on capabilities.
     *
     * Preference order:
     * 1. Full sync (Continue)
     * 2. Partial sync (Kiro)
     * 3. Control-only (Cursor, Antigravity)
     *
     * Returns null if no editor is installed.
     */
    getBestAdapter(): Promise<IEditorAdapter | null>;
    /**
     * Get adapter by ID.
     */
    getAdapter(editorId: string): IEditorAdapter | undefined;
    /**
     * Get all registered adapters.
     */
    getAllAdapters(): IEditorAdapter[];
    /**
     * Clear detection cache (useful for testing or manual refresh).
     */
    clearCache(): void;
}
//# sourceMappingURL=EditorRegistry.d.ts.map