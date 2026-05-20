"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const KeyManager_1 = require("./auth/KeyManager");
const LaptopIdentity_1 = require("./auth/LaptopIdentity");
const EditorRegistry_1 = require("./editors/adapters/EditorRegistry");
const ContinueAdapter_1 = require("./editors/adapters/ContinueAdapter");
const KiroAdapter_1 = require("./editors/adapters/KiroAdapter");
const CursorAdapter_1 = require("./editors/adapters/CursorAdapter");
const AntigravityAdapter_1 = require("./editors/adapters/AntigravityAdapter");
const SessionManager_1 = require("./auth/SessionManager");
const WsClient_1 = require("./websocket/WsClient");
const FileWatcher_1 = require("./diff/FileWatcher");
const GitIntegrationModule_1 = require("./git/GitIntegrationModule");
const SnapshotEngine_1 = require("./diff/SnapshotEngine");
const PatchEncoder_1 = require("./diff/PatchEncoder");
const PairingWebviewPanel_1 = require("./pairing/PairingWebviewPanel");
const protocol_1 = require("@codelink/protocol");
async function activate(context) {
    // Auth
    const keyManager = new KeyManager_1.KeyManager(context.secrets);
    const laptopIdentity = new LaptopIdentity_1.LaptopIdentity(keyManager, context.globalState);
    let laptopId;
    try {
        laptopId = await laptopIdentity.ensureRegistered();
    }
    catch (err) {
        vscode.window.showErrorMessage(`CodeLink: Could not register with Auth Service. ` +
            `Check codelink.authServiceUrl in settings. Error: ${err}.`);
        return;
    }
    // Editor Adapters
    const registry = new EditorRegistry_1.EditorRegistry();
    registry.register(new ContinueAdapter_1.ContinueAdapter());
    registry.register(new KiroAdapter_1.KiroAdapter());
    registry.register(new CursorAdapter_1.CursorAdapter());
    registry.register(new AntigravityAdapter_1.AntigravityAdapter());
    // Session
    const sessionManager = new SessionManager_1.SessionManager(keyManager, laptopId);
    context.subscriptions.push({ dispose: () => sessionManager.dispose() });
    // WebSocket Client
    const wsClient = new WsClient_1.WsClient({
        onConnected: () => {
            vscode.window.setStatusBarMessage('$(plug) CodeLink: Mobile connected', 3000);
        },
        onDisconnected: () => {
            vscode.window.setStatusBarMessage('$(debug-disconnected) CodeLink: Disconnected', 3000);
        },
        onMessage: async (type, payload, id) => {
            switch (type) {
                case 'SNAPSHOT_REQUEST': {
                    if (!(0, protocol_1.isSnapshotRequestPayload)(payload)) {
                        return;
                    }
                    const { fileName } = payload;
                    await fileWatcher.handleSnapshotRequest(fileName);
                    break;
                }
                case 'PATCH_ACK':
                    break;
                case 'INJECT_PROMPT': {
                    if (!(0, protocol_1.isInjectPromptPayload)(payload)) {
                        return;
                    }
                    const { prompt } = payload;
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
    const git = new GitIntegrationModule_1.GitIntegrationModuleImpl();
    const snapshot = new SnapshotEngine_1.SnapshotEngine();
    const patches = new PatchEncoder_1.PatchEncoder();
    const fileWatcher = new FileWatcher_1.FileWatcher(git, snapshot, patches, wsClient);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        fileWatcher.start(workspaceRoot);
    }
    context.subscriptions.push({ dispose: () => fileWatcher.stop() });
    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('codelink.startPairing', () => {
        PairingWebviewPanel_1.PairingWebviewPanel.createOrShow(context, sessionManager, wsClient);
    }), vscode.commands.registerCommand('codelink.revokeSession', async () => {
        await sessionManager.revokeSession();
        wsClient.disconnect();
        vscode.window.showInformationMessage('CodeLink: Session revoked.');
    }), vscode.commands.registerCommand('codelink.showStatus', () => {
        const state = sessionManager.state;
        const sess = sessionManager.session;
        vscode.window.showInformationMessage(`CodeLink status ${state}` + (sess ? ` | session: ${sess.sessionId.slice(0, 12)}...` : ''));
    }));
}
function deactivate() {
}
//# sourceMappingURL=extension.js.map