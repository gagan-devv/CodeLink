import * as vscode from 'vscode';
import * as qrcode from 'qrcode';
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

export class PairingWebviewPanel {
    private static instance: PairingWebviewPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private disposed = false;

    static createOrShow(
        context: vscode.ExtensionContext,
        sessionManager: SessionManager,
        wsClient: WsClient
    ): void {
        if (PairingWebviewPanel.instance) {
            PairingWebviewPanel.instance.panel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'codelinkPairing',
            'CodeLink - Pair Mobile',
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true },
        );

        PairingWebviewPanel.instance = new PairingWebviewPanel(
            panel, context, sessionManager, wsClient,
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly context: vscode.ExtensionContext,
        private readonly sessionManager: SessionManager,
        private readonly wsClient: WsClient,
    ) {
        this.panel = panel;

        panel.onDidDispose(() => {
            this.disposed = true;
            PairingWebviewPanel.instance = undefined;
        }, null, context.subscriptions);

        panel.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'revoke') {
                this.sessionManager.revokeSession();
            } else if (msg.command === 'refresh') {
                this.startPairingFlow();
            }
        });

        this.startPairingFlow();
    }

    private async startPairingFlow(): Promise<void> {
        if (this.disposed) { return; }

        try {
            this.panel.webview.html = this.loadingHtml('Creating Session...');

            const { sessionId, qrPayload, expiresAt } = await this.sessionManager.createSession();

            const qrDataUrl = await qrcode.toDataURL(qrPayload, { width: 280, margin: 2 });

            if (this.disposed) { return; }
            this.panel.webview.html = this.pairingHtml(qrDataUrl, expiresAt);

            const session = await this.sessionManager.waitForMobile(sessionId, 90_000);

            if (this.disposed) { return; }

            this.wsClient.connect(session.relayWssUrl, session.laptopToken);
            this.panel.webview.html = this.pairedHtml(session.sessionId);
        
        } catch (err: unknown) {
            if (this.disposed) { return; }
            const msg = err instanceof Error ? err.message : String(err);

            if (msg.includes('timed out')) {
                this.startPairingFlow();
            } else {
                this.panel.webview.html = this.errorHtml(msg);
            }
        }
    }

    // HTML Templates
  private loadingHtml(message: string): string {
    return this.wrap(`<p class="muted">${message}</p>`);
  }

  private pairingHtml(qrDataUrl: string, expiresAt: number): string {
    const secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    return this.wrap(`
      <h2>Scan with your phone</h2>
      <img src="${qrDataUrl}" width="280" height="280" alt="QR code" />
      <p class="muted">Code expires in <span id="countdown">${secondsLeft}</span>s</p>
      <button onclick="refresh()">Refresh QR</button>
      <script>
        let t = ${secondsLeft};
        const el = document.getElementById('countdown');
        const iv = setInterval(() => {
          t--;
          if (el) el.textContent = String(t);
          if (t <= 0) clearInterval(iv);
        }, 1000);
        const vscode = acquireVsCodeApi();
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    `);
  }

  private pairedHtml(sessionId: string): string {
    return this.wrap(`
      <h2>✓ Mobile paired</h2>
      <p class="muted">Session: ${sessionId.slice(0, 16)}…</p>
      <button onclick="revoke()">Revoke session</button>
      <script>
        const vscode = acquireVsCodeApi();
        function revoke() { vscode.postMessage({ command: 'revoke' }); }
      </script>
    `);
  }

  private errorHtml(message: string): string {
    return this.wrap(`
      <h2>⚠ Error</h2>
      <p class="muted">${message}</p>
      <button onclick="refresh()">Try again</button>
      <script>
        const vscode = acquireVsCodeApi();
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    `);
  }

  private wrap(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 24px;
           display: flex; flex-direction: column; align-items: center; gap: 16px; }
    h2   { margin: 0; }
    img  { border-radius: 8px; }
    .muted { color: var(--vscode-descriptionForeground); font-size: 13px; }
    button { background: var(--vscode-button-background);
             color: var(--vscode-button-foreground);
             border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>${body}</body>
</html>`;
  }
}
