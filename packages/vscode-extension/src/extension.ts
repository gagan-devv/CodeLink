import * as vscode from 'vscode'
import { KeyManager } from "./auth/KeyManager";
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
import { error } from 'node:console';
import { PairingWebviewPanel } from './pairing/PairingWebviewPanel';

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
                    const { fileName } = payload as { fileName: string };
                    await fileWatcher.handleSnapshotRequest(fileName);
                    break;
                }
                case 'PATCH_ACK':
                    break;
                case 'INJECT_PROMPT': {
                    const { prompt } = payload as { prompt: string };
                    const adapter = await registry.getBestAdapter();
                    if (!adapter) {
                        wsClient.send('PROMPT_RESPONSE', {
                            originalId: id, success: false, error: 'No AI editor detected',
                        });
                        return;
                    }
                    const result = await adapter.injectPrompt(prompt);
                    wsClient.send('PROMPT_RESPONSE', {
                        originalId: id,
                        success: result.success,
                        editorUser: adapter.editorName,
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
        }
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
        }),

        vscode.commands.registerCommand('codelink.showStatus', () => {
            const state = sessionManager.state;
            const sess = sessionManager.session;
            vscode.window.showInformationMessage(
                `CodeLink status ${state}` + (sess ? ` | session: ${sess.sessionId.slice(0, 12)}...` : '')
            );
        })
    );
}

export function deactivate(): void {

}