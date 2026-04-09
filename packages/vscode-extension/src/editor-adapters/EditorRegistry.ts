import { EditorAdapter } from './EditorAdapter';
import { ContinueAdapter } from './ContinueAdapter';
import { KiroAdapter, CursorAdapter, AntigravityAdapter } from './OtherAdapters';
import { VSCodeAdapter } from './VSCodeAdapter';

export class EditorRegistry {
  private adapters: EditorAdapter[] = [];

  constructor() {
    this.registerAdapters();
  }

  private registerAdapters() {
    // Register adapters in priority order
    // 1. Full Sync capable editors
    this.adapters.push(new ContinueAdapter());

    // 2. Partial Sync capable editors
    this.adapters.push(new KiroAdapter());

    // 3. Control-Only capable editors
    this.adapters.push(new CursorAdapter());
    this.adapters.push(new AntigravityAdapter());

    // 4. Fallback
    this.adapters.push(new VSCodeAdapter());
  }

  /**
   * Get the best available editor adapter
   */
  async getBestAvailableAdapter(): Promise<EditorAdapter | undefined> {
    for (const adapter of this.adapters) {
      if (await adapter.isAvailable()) {
        return adapter;
      }
    }
    return undefined;
  }

  /**
   * Get all available adapters
   */
  async getAvailableAdapters(): Promise<EditorAdapter[]> {
    const available: EditorAdapter[] = [];
    for (const adapter of this.adapters) {
      if (await adapter.isAvailable()) {
        available.push(adapter);
      }
    }
    return available;
  }

  /**
   * Get adapter by ID
   */
  getAdapter(id: string): EditorAdapter | undefined {
    return this.adapters.find((a) => a.id === id);
  }
}
