import * as vscode from 'vscode';
import { PingMessage } from '@codelink/protocol';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('codelink.hello', () => {
    // Example: Create a typed message
    const message: PingMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'ping',
      source: 'extension',
    };

    vscode.window.showInformationMessage(
      `CodeLink Extension Active! Message ID: ${message.id}`
    );
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
