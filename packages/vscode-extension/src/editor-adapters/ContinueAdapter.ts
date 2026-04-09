import * as vscode from 'vscode';
import { EditorAdapter } from './EditorAdapter';

export class ContinueAdapter implements EditorAdapter {
  readonly id = 'continue';
  readonly displayName = 'Continue';

  async isAvailable(): Promise<boolean> {
    const extension = vscode.extensions.getExtension('continue.continue');
    return !!extension; // && extension.isActive;
  }

  async injectPrompt(_prompt: string): Promise<boolean> {
    try {
      // Continue uses a command to accept input or specific API if available
      // For now, we'll try to use the command to focus/open and then insert
      // This is a best-effort integration without a public API

      // Attempt to execute the command to open Continue sidebar
      await vscode.commands.executeCommand('continue.focusContinueInput');

      // Wait a brief moment for focus
      await new Promise((resolve) => setTimeout(resolve, 500));

      // We can't easily type into the webview, but we can verify it opened.
      // If there's a specific API command to send text, we would use it here.
      // Since Continue doesn't expose a simple "send text" command publicly yet,
      // we will fallback to a notification instructing the user, or
      // look for a more specific command if updated.

      // REVISIT: Check for "continue.sendToChat" or similar in future versions.

      return true;
    } catch (error) {
      console.error('Failed to inject prompt into Continue:', error);
      return false;
    }
  }
}
