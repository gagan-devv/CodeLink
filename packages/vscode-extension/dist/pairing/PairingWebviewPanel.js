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
exports.PairingWebviewPanel = void 0;
const vscode = __importStar(require("vscode"));
const qrcode = __importStar(require("qrcode"));
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
class PairingWebviewPanel {
    static createOrShow(context, sessionManager, wsClient) {
        if (PairingWebviewPanel.instance) {
            PairingWebviewPanel.instance.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel('codelinkPairing', 'CodeLink - Pair Mobile', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
        PairingWebviewPanel.instance = new PairingWebviewPanel(panel, context, sessionManager, wsClient);
    }
    constructor(panel, context, sessionManager, wsClient) {
        this.context = context;
        this.sessionManager = sessionManager;
        this.wsClient = wsClient;
        this.disposed = false;
        this.panel = panel;
        panel.onDidDispose(() => {
            this.disposed = true;
            PairingWebviewPanel.instance = undefined;
        }, null, context.subscriptions);
        panel.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'revoke') {
                this.sessionManager.revokeSession();
            }
            else if (msg.command === 'refresh') {
                this.startPairingFlow();
            }
        });
        this.startPairingFlow();
    }
    async startPairingFlow() {
        if (this.disposed) {
            return;
        }
        try {
            this.panel.webview.html = this.loadingHtml('Creating Session...');
            const { sessionId, qrPayload, expiresAt } = await this.sessionManager.createSession();
            const qrDataUrl = await qrcode.toDataURL(qrPayload, { width: 280, margin: 2 });
            if (this.disposed) {
                return;
            }
            this.panel.webview.html = this.pairingHtml(qrDataUrl, expiresAt, qrPayload);
            const session = await this.sessionManager.waitForMobile(sessionId, 90000);
            if (this.disposed) {
                return;
            }
            this.wsClient.connect(session.relayWssUrl, session.laptopToken);
            this.panel.webview.html = this.pairedHtml(session.sessionId);
        }
        catch (err) {
            if (this.disposed) {
                return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('timed out')) {
                this.startPairingFlow();
            }
            else {
                this.panel.webview.html = this.errorHtml(msg);
            }
        }
    }
    // HTML Templates
    loadingHtml(message) {
        return this.wrap(`<p class="muted">${message}</p>`);
    }
    pairingHtml(qrDataUrl, expiresAt, qrPayload) {
        const secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
        return this.wrap(`
      <h2>Scan with your phone</h2>
      <img src="${qrDataUrl}" width="280" height="280" alt="QR code" />
      <p class="muted">Code expires in <span id="countdown">${secondsLeft}</span>s</p>
      <textarea style="width:260px;height:60px;font-size:10px;margin-top:8px;
      background:#1a1a1a;color:#555;border:1px solid #333;resize:none"
      readonly>${qrPayload}</textarea>
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
    pairedHtml(sessionId) {
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
    errorHtml(message) {
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
    wrap(body) {
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
exports.PairingWebviewPanel = PairingWebviewPanel;
//# sourceMappingURL=PairingWebviewPanel.js.map