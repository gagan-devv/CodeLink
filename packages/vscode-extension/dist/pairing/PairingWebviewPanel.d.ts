import * as vscode from 'vscode';
import { SessionManager } from '../auth/SessionManager';
import { WsClient } from '../websocket/WsClient';
/**
 * VS Code Webview panel that displays the QR code for mobile pairing.
 *
 * Lifecycle:
 *   1. Extension calls createOrShow()
 *   2. Panel creates a session on the Auth Service
 *   3. Renders QR code with 60-second countdown
 *   4. Polls Auth Service every 2s via SessionManager.waitForMobile()
 *   5. On success: connects WsClient, shows "Paired ✓", offers Revoke button
 *   6. On timeout: auto-refreshes (new QR)
 */
export declare class PairingWebviewPanel {
    private readonly context;
    private readonly sessionManager;
    private readonly wsClient;
    private static instance;
    private readonly panel;
    private disposed;
    static createOrShow(context: vscode.ExtensionContext, sessionManager: SessionManager, wsClient: WsClient): void;
    private constructor();
    private startPairingFlow;
    private loadingHtml;
    private pairingHtml;
    private pairedHtml;
    private errorHtml;
    private wrap;
}
//# sourceMappingURL=PairingWebviewPanel.d.ts.map