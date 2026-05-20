"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorRegistry = void 0;
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
class EditorRegistry {
    constructor() {
        this.adapters = new Map();
        this.detectionCache = new Map();
    }
    /**
     * Register an editor adapter.
     *
     * Called during extension activation to register all known adapters.
     */
    register(adapter) {
        this.adapters.set(adapter.editorId, adapter);
    }
    /**
     * Detect all available editors.
     *
     * Returns map of editorId -> DetectionResult.
     * Results are cached to avoid repeated command queries.
     */
    async detectAll() {
        const results = new Map();
        for (const [id, adapter] of this.adapters) {
            // Check cache first
            if (this.detectionCache.has(id)) {
                results.set(id, this.detectionCache.get(id));
                continue;
            }
            // Detect and cache
            const result = await adapter.detect();
            this.detectionCache.set(id, result);
            results.set(id, result);
        }
        return results;
    }
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
    async getBestAdapter() {
        const available = await this.detectAll();
        // Filter to installed editors
        const installed = Array.from(this.adapters.values()).filter((adapter) => available.get(adapter.editorId)?.isInstalled);
        if (installed.length === 0) {
            return null;
        }
        // Sort by sync level preference
        const syncLevelPriority = {
            full: 3,
            partial: 2,
            'control-only': 1,
        };
        installed.sort((a, b) => syncLevelPriority[b.capabilities.syncLevel] - syncLevelPriority[a.capabilities.syncLevel]);
        return installed[0];
    }
    /**
     * Get adapter by ID.
     */
    getAdapter(editorId) {
        return this.adapters.get(editorId);
    }
    /**
     * Get all registered adapters.
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    /**
     * Clear detection cache (useful for testing or manual refresh).
     */
    clearCache() {
        this.detectionCache.clear();
    }
}
exports.EditorRegistry = EditorRegistry;
//# sourceMappingURL=EditorRegistry.js.map