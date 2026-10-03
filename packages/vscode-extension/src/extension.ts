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
import { resolveTargetFile } from './workspace/resolveTargetFile';
import { getOutputChannel, logLine } from './logger';
import {
  isInjectPromptPayload,
  isSnapshotRequestPayload,
  InjectPromptPayload,
} from '@codelink/protocol';
import { TerminalStatusBar } from './terminal/TerminalStatusBar';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = getOutputChannel();
  context.subscriptions.push(outputChannel);

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
  const sessionManager = new SessionManager(keyManager, laptopId, laptopIdentity);
  context.subscriptions.push({ dispose: () => sessionManager.dispose() });

  const fileWatcherRef = { current: null as FileWatcher | null };

  // WebSocket Client
  const wsClient = new WsClient({
    onConnected: () => {
      vscode.window.setStatusBarMessage('$(plug) CodeLink: Mobile connected', 3_000);
      fileWatcherRef.current?.resync();
    },
    onDisconnected: () => {
      vscode.window.setStatusBarMessage('$(debug-disconnected) CodeLink: Disconnected', 3_000);
    },
    onMessage: async (type, payload, id) => {
      if (type.startsWith('TERM_')) {
        // Managed terminal frames are handled by companion daemon, ignore in extension
        return;
      }
      switch (type) {
        case 'SNAPSHOT_REQUEST': {
          if (!isSnapshotRequestPayload(payload)) {
            return;
          }
          const { fileName } = payload as { fileName: string };
          await fileWatcherRef.current?.handleSnapshotRequest(fileName);
          break;
        }
        case 'PATCH_ACK':
          break;
        case 'INJECT_PROMPT': {
          if (!isInjectPromptPayload(payload)) {
            return;
          }
          const { prompt, targetFile, lineRange, selectedCode, source } =
            payload as InjectPromptPayload;

          if (targetFile) {
            const resolved = await resolveTargetFile(targetFile);
            if (resolved.status === 'blocked') {
              console.warn(
                `[CodeLink Security] Blocked attempt to access file outside workspace: ${targetFile}`
              );
              wsClient.send('PROMPT_RESPONSE', {
                originalId: id,
                success: false,
                error: 'targetFile is outside the workspace',
              });
              return;
            } else if (resolved.status === 'no_workspace') {
              console.warn('[CodeLink] No workspace folder open to resolve targetFile');
            } else if (resolved.status === 'not_found') {
              console.warn(`[CodeLink] Target file not found: ${targetFile}`);
            } else if (resolved.status === 'ok') {
              try {
                const document = await vscode.workspace.openTextDocument(resolved.uri);
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
  fileWatcherRef.current = fileWatcher;

  const startFileWatcher = () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      fileWatcher.start(root);
    } else {
      logLine('CodeLink: open a folder to sync files');
      fileWatcher.start();
    }
  };

  startFileWatcher();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      startFileWatcher();
    }),
    { dispose: () => fileWatcher.stop() }
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codelink.startPairing', () => {
      PairingWebviewPanel.createOrShow(context, sessionManager, wsClient);
    }),

    vscode.commands.registerCommand('codelink.revokeSession', async () => {
      await sessionManager.revokeSession();
      wsClient.disconnect();
      vscode.window.showInformationMessage('CodeLink: Session revoked.');
    }),

    vscode.commands.registerCommand('codelink.showStatus', () => {
      const config = vscode.workspace.getConfiguration('codelink');
      const authUrl = config.get<string>('authServiceUrl', 'http://localhost:8081');
      const relayUrl = config.get<string>('relayServiceUrl', 'ws://localhost:8082');
      const sessionState = sessionManager.state;
      const isConnected = wsClient.isConnected();

      vscode.window.showInformationMessage(
        `CodeLink Status: Session: ${sessionState} | WebSocket: ${isConnected ? 'Connected' : 'Disconnected'} | Auth URL: ${authUrl} | Relay URL: ${relayUrl}`
      );
    }),

    vscode.commands.registerCommand('codelink.resetIdentity', async () => {
      try {
        await sessionManager.revokeSession();
        wsClient.disconnect();
        await laptopIdentity.resetIdentity();
        sessionManager.updateLaptopId('');
        vscode.window.showInformationMessage('CodeLink: Identity and keypair reset successfully.');
      } catch (err) {
        vscode.window.showErrorMessage(`CodeLink: Failed to reset identity: ${err}`);
      }
    }),

    vscode.commands.registerCommand('codelink.reRegister', async () => {
      try {
        await sessionManager.revokeSession();
        wsClient.disconnect();
        const newLaptopId = await laptopIdentity.reRegister();
        sessionManager.updateLaptopId(newLaptopId);
        vscode.window.showInformationMessage(
          `CodeLink: Laptop re-registered successfully. New Laptop ID: ${newLaptopId}`
        );
      } catch (err) {
        vscode.window.showErrorMessage(`CodeLink: Failed to re-register laptop: ${err}`);
      }
    }),

    vscode.commands.registerCommand('codelink.terminalMenu', async () => {
      await terminalStatusBar.showMenu();
    })
  );

  const terminalStatusBar = new TerminalStatusBar();
  context.subscriptions.push({ dispose: () => terminalStatusBar.dispose() });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('codelink.authServiceUrl')) {
        try {
          await sessionManager.revokeSession();
          wsClient.disconnect();
          const newLaptopId = await laptopIdentity.reRegister();
          sessionManager.updateLaptopId(newLaptopId);
          vscode.window.showInformationMessage(
            `CodeLink: Auth service URL changed. Re-registered with new identity (${newLaptopId}).`
          );
        } catch (err) {
          vscode.window.showErrorMessage(
            `CodeLink: Failed to re-register after auth URL change: ${err}`
          );
        }
      }
    })
  );
}

export function deactivate(): void {}
