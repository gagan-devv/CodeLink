import * as vscode from 'vscode';

/**
 * Interface for AI Editor Adapters
 */
export interface EditorAdapter {
  /**
   * Unique identifier for the editor (e.g., 'continue', 'kiro', 'cursor')
   */
  readonly id: string;

  /**
   * Display name of the editor
   */
  readonly displayName: string;

  /**
   * Check if the editor is available/installed
   */
  isAvailable(): Promise<boolean>;

  /**
   * Inject a prompt into the editor
   * @param prompt The text prompt to inject
   * @returns check if injection was successful
   */
  injectPrompt(prompt: string): Promise<boolean>;
}
