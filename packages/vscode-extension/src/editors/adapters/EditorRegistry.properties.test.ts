import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { EditorRegistry } from './EditorRegistry';
import {
  IEditorAdapter,
  EditorCapabilities,
  DetectionResult,
  PromptInjectionResult,
} from './types';

// Mock adapter factory for testing
class MockAdapter implements IEditorAdapter {
  constructor(
    public readonly editorId: string,
    public readonly editorName: string,
    public readonly capabilities: EditorCapabilities,
    private isInstalled: boolean = true
  ) {}

  async detect(): Promise<DetectionResult> {
    return {
      isInstalled: this.isInstalled,
      availableCommands: this.isInstalled
        ? [`${this.editorId}.command1`, `${this.editorId}.command2`]
        : [],
    };
  }

  async injectPrompt(prompt: string): Promise<PromptInjectionResult> {
    return {
      success: true,
      commandUsed: `${this.editorId}.injectPrompt`,
    };
  }
}

// Helper to create adapters with different sync levels
function createAdapter(
  id: string,
  syncLevel: EditorCapabilities['syncLevel'],
  isInstalled: boolean = true
): IEditorAdapter {
  return new MockAdapter(
    id,
    `${id}-editor`,
    {
      canInjectPrompt: true,
      canReadChatHistory: syncLevel === 'full',
      canStreamAssistantTokens: syncLevel === 'full',
      canReadDiffArtifacts: syncLevel !== 'control-only',
      canPreventAutoApply: syncLevel !== 'control-only',
      syncLevel,
    },
    isInstalled
  );
}

describe('EditorRegistry - Property-Based Tests', () => {
  let registry: EditorRegistry;

  beforeEach(() => {
    registry = new EditorRegistry();
  });

  // Feature: editor-adapter-system, Property 3: Adapter Selection Prefers Higher Fidelity
  it('Property 3: getBestAdapter prefers higher sync levels', async () => {
    // Generator for sync levels
    const syncLevelArb = fc.constantFrom<EditorCapabilities['syncLevel']>(
      'full',
      'partial',
      'control-only'
    );

    // Generator for arrays of adapters with random sync levels
    const adaptersArb = fc
      .array(
        fc
          .tuple(fc.string({ minLength: 1, maxLength: 10 }), syncLevelArb)
          .map(([id, syncLevel]: [string, EditorCapabilities['syncLevel']]) =>
            createAdapter(`adapter-${id}`, syncLevel, true)
          ),
        { minLength: 1, maxLength: 10 }
      )
      .map((adapters: IEditorAdapter[]) => {
        // Ensure unique IDs
        const seen = new Set<string>();
        return adapters.filter((adapter: IEditorAdapter) => {
          if (seen.has(adapter.editorId)) {
            return false;
          }
          seen.add(adapter.editorId);
          return true;
        });
      })
      .filter((adapters: IEditorAdapter[]) => adapters.length > 0);

    await fc.assert(
      fc.asyncProperty(adaptersArb, async (adapters: IEditorAdapter[]) => {
        const testRegistry = new EditorRegistry();

        // Register all adapters
        adapters.forEach((adapter: IEditorAdapter) => testRegistry.register(adapter));

        // Get best adapter
        const best = await testRegistry.getBestAdapter();

        // Best should not be null since all adapters are installed
        expect(best).not.toBeNull();

        if (best) {
          // Best should have highest sync level among all adapters
          const syncLevelPriority: Record<
            EditorCapabilities['syncLevel'],
            number
          > = {
            full: 3,
            partial: 2,
            'control-only': 1,
          };

          const bestPriority = syncLevelPriority[best.capabilities.syncLevel];

          adapters.forEach((adapter: IEditorAdapter) => {
            const adapterPriority =
              syncLevelPriority[adapter.capabilities.syncLevel];
            expect(bestPriority).toBeGreaterThanOrEqual(adapterPriority);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 9: Registry Maintains Adapter List
  it('Property 9: getAllAdapters returns exactly the registered adapters', () => {
    // Generator for arrays of unique adapter IDs
    const adapterIdsArb = fc
      .array(fc.string({ minLength: 1, maxLength: 10 }), {
        minLength: 0,
        maxLength: 20,
      })
      .map((ids) => Array.from(new Set(ids))); // Ensure uniqueness

    fc.assert(
      fc.property(adapterIdsArb, (adapterIds) => {
        const testRegistry = new EditorRegistry();

        // Create and register adapters
        const adapters = adapterIds.map((id) =>
          createAdapter(id, 'partial', true)
        );
        adapters.forEach((adapter) => testRegistry.register(adapter));

        // Get all adapters
        const retrieved = testRegistry.getAllAdapters();

        // Should have exactly the same number of adapters
        expect(retrieved.length).toBe(adapters.length);

        // Should contain all registered adapter IDs
        const retrievedIds = new Set(retrieved.map((a) => a.editorId));
        const registeredIds = new Set(adapters.map((a) => a.editorId));

        expect(retrievedIds).toEqual(registeredIds);

        // Each registered adapter should be retrievable by ID
        adapters.forEach((adapter) => {
          const found = testRegistry.getAdapter(adapter.editorId);
          expect(found).toBeDefined();
          expect(found?.editorId).toBe(adapter.editorId);
        });
      }),
      { numRuns: 100 }
    );
  });

  // Additional property: Detection cache consistency
  it('Property 10: Detection cache returns consistent results', async () => {
    const adapterArb = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom<EditorCapabilities['syncLevel']>(
          'full',
          'partial',
          'control-only'
        ),
        fc.boolean()
      )
      .map(([id, syncLevel, isInstalled]) =>
        createAdapter(id, syncLevel, isInstalled)
      );

    await fc.assert(
      fc.asyncProperty(adapterArb, async (adapter) => {
        const testRegistry = new EditorRegistry();
        testRegistry.register(adapter);

        // First detection
        const result1 = await testRegistry.detectAll();

        // Second detection (should use cache)
        const result2 = await testRegistry.detectAll();

        // Results should be identical
        expect(result1.size).toBe(result2.size);
        expect(result1.get(adapter.editorId)).toEqual(
          result2.get(adapter.editorId)
        );
      }),
      { numRuns: 100 }
    );
  });

  // Property: getBestAdapter returns null when no editors are installed
  it('Property: getBestAdapter returns null when no editors installed', async () => {
    const adapterIdsArb = fc
      .array(fc.string({ minLength: 1, maxLength: 10 }), {
        minLength: 1,
        maxLength: 10,
      })
      .map((ids) => Array.from(new Set(ids)));

    await fc.assert(
      fc.asyncProperty(adapterIdsArb, async (adapterIds) => {
        const testRegistry = new EditorRegistry();

        // Create adapters that are NOT installed
        const adapters = adapterIds.map((id) =>
          createAdapter(id, 'partial', false)
        );
        adapters.forEach((adapter) => testRegistry.register(adapter));

        // Get best adapter
        const best = await testRegistry.getBestAdapter();

        // Should be null since no editors are installed
        expect(best).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  // Property: Sync level priority ordering
  it('Property: Full sync is preferred over partial, partial over control-only', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        async (hasFullSync, hasPartialSync, hasControlOnly) => {
          // Skip if no adapters would be installed
          if (!hasFullSync && !hasPartialSync && !hasControlOnly) {
            return;
          }

          const testRegistry = new EditorRegistry();

          if (hasFullSync) {
            testRegistry.register(createAdapter('full-editor', 'full', true));
          }
          if (hasPartialSync) {
            testRegistry.register(
              createAdapter('partial-editor', 'partial', true)
            );
          }
          if (hasControlOnly) {
            testRegistry.register(
              createAdapter('control-editor', 'control-only', true)
            );
          }

          const best = await testRegistry.getBestAdapter();

          expect(best).not.toBeNull();

          if (best) {
            // Verify priority: full > partial > control-only
            if (hasFullSync) {
              expect(best.capabilities.syncLevel).toBe('full');
            } else if (hasPartialSync) {
              expect(best.capabilities.syncLevel).toBe('partial');
            } else {
              expect(best.capabilities.syncLevel).toBe('control-only');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
