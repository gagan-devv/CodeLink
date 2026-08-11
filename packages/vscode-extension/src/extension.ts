import * as vscode from 'vscode';
import { KeyManager } from './auth/KeyManager';
import { LaptopIdentity } from './auth/LaptopIdentity';
import { EditorRegistry } from './editors/adapters/EditorRegistry';
import { ContinueAdapter } from './editors/adapters/ContinueAdapter';
import { KiroAdapter } from './editors/adapters/KiroAdapter';
import { CursorAdapter } from './editors/adapters/CursorAdapter';
import { AntigravityAdapter } from './editors/adapters/AntigravityAdapter';
import { SessionManager } from './auth/SessionManager';
import { WsClient } from './websocket/WsClient';
import { FileWatcher } from './diff/FileWatcher';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { SnapshotEngine } from './diff/SnapshotEngine';
import { PatchEncoder } from './diff/PatchEncoder';
import { PairingWebviewPanel } from './pairing/PairingWebviewPanel';
import * as path from 'path';
import { isInjectPromptPayload, isSnapshotRequestPayload, InjectPromptPayload } from '@codelink/protocol';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Auth
  const keyManager = new KeyManager(context.secrets);
  const laptopIdentity = new LaptopIdentity(keyManager, context.globalState);

  let laptopId: string;
  try {
    laptopId = await laptopIdentity.ensureRegistered();
  } catch (err) {
    vscode.window.showErrorMessage(
      `CodeLink: Could not register with Auth Service. ` +
        `Check codelink.authServiceUrl in settings. Error: ${err}.`
    );
    return;
  }

  // Editor Adapters
  const registry = new EditorRegistry();
  registry.register(new ContinueAdapter());
  registry.register(new KiroAdapter());
  registry.register(new CursorAdapter());
  registry.register(new AntigravityAdapter());

  // Session
  const sessionManager = new SessionManager(keyManager, laptopId);
  context.subscriptions.push({ dispose: () => sessionManager.dispose() });

  // WebSocket Client
  const wsClient = new WsClient({
    onConnected: () => {
      vscode.window.setStatusBarMessage('$(plug) CodeLink: Mobile connected', 3_000);
    },
    onDisconnected: () => {
      vscode.window.setStatusBarMessage('$(debug-disconnected) CodeLink: Disconnected', 3_000);
    },
    onMessage: async (type, payload, id) => {
      switch (type) {
        case 'SNAPSHOT_REQUEST': {
          if (!isSnapshotRequestPayload(payload)) {
            return;
          }
          const { fileName } = payload as { fileName: string };
          await fileWatcher.handleSnapshotRequest(fileName);
          break;
        }
        case 'PATCH_ACK':
          break;
        case 'INJECT_PROMPT': {
          if (!isInjectPromptPayload(payload)) {
            return;
          }
          const { prompt, targetFile, lineRange, selectedCode, source } = payload as InjectPromptPayload;

          if (targetFile) {
            let targetUri: vscode.Uri | undefined;
            if (path.isAbsolute(targetFile)) {
              targetUri = vscode.Uri.file(targetFile);
            } else {
              const foundFiles = await vscode.workspace.findFiles(targetFile, undefined, 1);
              if (foundFiles.length > 0) {
                targetUri = foundFiles[0];
              } else {
                const globFiles = await vscode.workspace.findFiles(`**/${targetFile}`, undefined, 1);
                if (globFiles.length > 0) {
                  targetUri = globFiles[0];
                } else {
                  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                  if (workspaceFolder) {
                    targetUri = vscode.Uri.joinPath(workspaceFolder.uri, targetFile);
                  }
                }
              }
            }

            if (targetUri) {
              try {
                const document = await vscode.workspace.openTextDocument(targetUri);
                const editor = await vscode.window.showTextDocument(document);
                if (
                  lineRange &&
                  typeof lineRange.startLine === 'number' &&
                  typeof lineRange.endLine === 'number'
                ) {
                  const startPos = new vscode.Position(Math.max(0, lineRange.startLine - 1), 0);
                  const endPos = new vscode.Position(lineRange.endLine, 0);
                  const selection = new vscode.Selection(startPos, endPos);
                  editor.selection = selection;
                  editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                }
              } catch (err) {
                console.error(`Failed to open target file ${targetFile}:`, err);
              }
            }
          }

          const adapter = await registry.getBestAdapter();
          if (!adapter) {
            wsClient.send('PROMPT_RESPONSE', {
              originalId: id,
              success: false,
              error: 'No AI editor detected',
            });
            return;
          }
          const result = await adapter.injectPrompt(prompt, {
            targetFile,
            lineRange,
            selectedCode,
            source,
          });
          wsClient.send('PROMPT_RESPONSE', {
            originalId: id,
            success: result.success,
            editorUsed: adapter.editorName,
            error: result.error,
          });
          break;
        }
        case 'SESSION_REVOKED': {
          wsClient.disconnect();
          vscode.window.showInformationMessage('CodeLink: Session ended.');
          break;
        }
      }
    },
  });

  context.subscriptions.push({ dispose: () => wsClient.disconnect() });

  // Diff Engine
  const git = new GitIntegrationModuleImpl();
  const snapshot = new SnapshotEngine();
  const patches = new PatchEncoder();
  const fileWatcher = new FileWatcher(git, snapshot, patches, wsClient);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    fileWatcher.start(workspaceRoot);
  }

  context.subscriptions.push({ dispose: () => fileWatcher.stop() });

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codelink.startPairing', () => {
      PairingWebviewPanel.createOrShow(context, sessionManager, wsClient);
    }),

    vscode.commands.registerCommand('codelink.revokeSession', async () => {
      await sessionManager.revokeSession();
      wsClient.disconnect();
      vscode.window.showInformationMessage('CodeLink: Session revoked.');
    })
  );
}

export function deactivate(): void {}
