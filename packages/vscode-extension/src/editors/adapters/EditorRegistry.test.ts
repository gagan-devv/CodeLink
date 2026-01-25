import { describe, it, expect, beforeEach } from 'vitest';
import { EditorRegistry } from './EditorRegistry';
import {
  IEditorAdapter,
  EditorCapabilities,
  DetectionResult,
  PromptInjectionResult,
} from './types';

// Mock adapter for testing
class MockAdapter implements IEditorAdapter {
  constructor(
    public readonly editorId: string,
    public readonly editorName: string,
    public readonly capabilities: EditorCapabilities,
    private detectResult: DetectionResult
  ) {}

  async detect(): Promise<DetectionResult> {
    return this.detectResult;
  }

  async injectPrompt(prompt: string): Promise<PromptInjectionResult> {
    return {
      success: true,
      commandUsed: `${this.editorId}.injectPrompt`,
    };
  }
}

describe('EditorRegistry - Unit Tests', () => {
  let registry: EditorRegistry;

  beforeEach(() => {
    registry = new EditorRegistry();
  });

  describe('Registration and Retrieval', () => {
    it('should register an adapter and retrieve it by ID', () => {
      const adapter = new MockAdapter(
        'test-editor',
        'Test Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      registry.register(adapter);

      const retrieved = registry.getAdapter('test-editor');
      expect(retrieved).toBe(adapter);
      expect(retrieved?.editorId).toBe('test-editor');
      expect(retrieved?.editorName).toBe('Test Editor');
    });

    it('should return undefined for non-existent adapter ID', () => {
      const retrieved = registry.getAdapter('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should return all registered adapters', () => {
      const adapter1 = new MockAdapter(
        'editor1',
        'Editor 1',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      const adapter2 = new MockAdapter(
        'editor2',
        'Editor 2',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'full',
        },
        { isInstalled: true }
      );

      registry.register(adapter1);
      registry.register(adapter2);

      const allAdapters = registry.getAllAdapters();
      expect(allAdapters).toHaveLength(2);
      expect(allAdapters).toContain(adapter1);
      expect(allAdapters).toContain(adapter2);
    });

    it('should return empty array when no adapters are registered', () => {
      const allAdapters = registry.getAllAdapters();
      expect(allAdapters).toHaveLength(0);
    });
  });

  describe('Detection and Caching', () => {
    it('should detect all registered adapters', async () => {
      const adapter1 = new MockAdapter(
        'editor1',
        'Editor 1',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        {
          isInstalled: true,
          availableCommands: ['editor1.command1', 'editor1.command2'],
        }
      );

      const adapter2 = new MockAdapter(
        'editor2',
        'Editor 2',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'partial',
        },
        {
          isInstalled: false,
        }
      );

      registry.register(adapter1);
      registry.register(adapter2);

      const results = await registry.detectAll();

      expect(results.size).toBe(2);
      expect(results.get('editor1')?.isInstalled).toBe(true);
      expect(results.get('editor1')?.availableCommands).toEqual([
        'editor1.command1',
        'editor1.command2',
      ]);
      expect(results.get('editor2')?.isInstalled).toBe(false);
    });

    it('should cache detection results', async () => {
      let detectCallCount = 0;

      class CountingAdapter extends MockAdapter {
        async detect(): Promise<DetectionResult> {
          detectCallCount++;
          return super.detect();
        }
      }

      const adapter = new CountingAdapter(
        'test-editor',
        'Test Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      registry.register(adapter);

      // First detection
      await registry.detectAll();
      expect(detectCallCount).toBe(1);

      // Second detection should use cache
      await registry.detectAll();
      expect(detectCallCount).toBe(1);
    });

    it('should clear cache and re-detect after clearCache()', async () => {
      let detectCallCount = 0;

      class CountingAdapter extends MockAdapter {
        async detect(): Promise<DetectionResult> {
          detectCallCount++;
          return super.detect();
        }
      }

      const adapter = new CountingAdapter(
        'test-editor',
        'Test Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      registry.register(adapter);

      // First detection
      await registry.detectAll();
      expect(detectCallCount).toBe(1);

      // Clear cache
      registry.clearCache();

      // Third detection should call detect again
      await registry.detectAll();
      expect(detectCallCount).toBe(2);
    });
  });

  describe('Best Adapter Selection', () => {
    it('should return null when no editors are installed', async () => {
      const adapter = new MockAdapter(
        'test-editor',
        'Test Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: false }
      );

      registry.register(adapter);

      const best = await registry.getBestAdapter();
      expect(best).toBeNull();
    });

    it('should return the only installed adapter', async () => {
      const adapter = new MockAdapter(
        'test-editor',
        'Test Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      registry.register(adapter);

      const best = await registry.getBestAdapter();
      expect(best).toBe(adapter);
    });

    it('should prefer full sync over partial sync', async () => {
      const partialAdapter = new MockAdapter(
        'partial-editor',
        'Partial Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'partial',
        },
        { isInstalled: true }
      );

      const fullAdapter = new MockAdapter(
        'full-editor',
        'Full Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'full',
        },
        { isInstalled: true }
      );

      registry.register(partialAdapter);
      registry.register(fullAdapter);

      const best = await registry.getBestAdapter();
      expect(best).toBe(fullAdapter);
      expect(best?.capabilities.syncLevel).toBe('full');
    });

    it('should prefer partial sync over control-only', async () => {
      const controlAdapter = new MockAdapter(
        'control-editor',
        'Control Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      const partialAdapter = new MockAdapter(
        'partial-editor',
        'Partial Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'partial',
        },
        { isInstalled: true }
      );

      registry.register(controlAdapter);
      registry.register(partialAdapter);

      const best = await registry.getBestAdapter();
      expect(best).toBe(partialAdapter);
      expect(best?.capabilities.syncLevel).toBe('partial');
    });

    it('should prefer full sync when all three levels are available', async () => {
      const controlAdapter = new MockAdapter(
        'control-editor',
        'Control Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      const partialAdapter = new MockAdapter(
        'partial-editor',
        'Partial Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'partial',
        },
        { isInstalled: true }
      );

      const fullAdapter = new MockAdapter(
        'full-editor',
        'Full Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'full',
        },
        { isInstalled: true }
      );

      registry.register(controlAdapter);
      registry.register(partialAdapter);
      registry.register(fullAdapter);

      const best = await registry.getBestAdapter();
      expect(best).toBe(fullAdapter);
      expect(best?.capabilities.syncLevel).toBe('full');
    });

    it('should only consider installed adapters', async () => {
      const installedAdapter = new MockAdapter(
        'installed-editor',
        'Installed Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: false,
          canStreamAssistantTokens: false,
          canReadDiffArtifacts: false,
          canPreventAutoApply: false,
          syncLevel: 'control-only',
        },
        { isInstalled: true }
      );

      const notInstalledAdapter = new MockAdapter(
        'not-installed-editor',
        'Not Installed Editor',
        {
          canInjectPrompt: true,
          canReadChatHistory: true,
          canStreamAssistantTokens: true,
          canReadDiffArtifacts: true,
          canPreventAutoApply: true,
          syncLevel: 'full',
        },
        { isInstalled: false }
      );

      registry.register(installedAdapter);
      registry.register(notInstalledAdapter);

      const best = await registry.getBestAdapter();
      expect(best).toBe(installedAdapter);
      expect(best?.editorId).toBe('installed-editor');
    });
  });
});
