import * as vscode from 'vscode';
import { EditorAdapter } from './EditorAdapter';

export class KiroAdapter implements EditorAdapter {
  readonly id = 'kiro';
  readonly displayName = 'Kiro';

  async isAvailable(): Promise<boolean> {
    return !!vscode.extensions.getExtension('kiro.kiro');
  }

  async injectPrompt(_prompt: string): Promise<boolean> {
    // Placeholder implementation
    return false;
  }
}

export class CursorAdapter implements EditorAdapter {
  readonly id = 'cursor';
  readonly displayName = 'Cursor';

  async isAvailable(): Promise<boolean> {
    // Cursor identifies itself differently, often via env or specific extension
    return vscode.env.appName.includes('Cursor');
  }

  async injectPrompt(_prompt: string): Promise<boolean> {
    // Cursor AI command implementation would go here
    return false;
  }
}

export class AntigravityAdapter implements EditorAdapter {
  readonly id = 'antigravity';
  readonly displayName = 'Antigravity';

  async isAvailable(): Promise<boolean> {
    return !!vscode.extensions.getExtension('google.antigravity');
  }

  async injectPrompt(_prompt: string): Promise<boolean> {
    // Antigravity implementation
    return false;
  }
}
