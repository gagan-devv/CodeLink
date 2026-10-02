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

export interface MinimalPairingPayload {
  sessionId: string;
  challenge: string;
}

/**
 * Shortens a pairing payload to minimal { sessionId, challenge } only,
 * dropping redundant fields like relayWss / relayWSS.
 */
export function shortenPairingPayload(payload: string): string {
  try {
    const trimmed = payload.trim();
    let jsonStr = '';
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      jsonStr = trimmed;
    } else {
      const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      jsonStr = Buffer.from(padded, 'base64').toString('utf8');
    }
    const parsed = JSON.parse(jsonStr);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.sessionId === 'string' &&
      typeof parsed.challenge === 'string'
    ) {
      const minimal: MinimalPairingPayload = {
        sessionId: parsed.sessionId,
        challenge: parsed.challenge,
      };
      return Buffer.from(JSON.stringify(minimal))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
  } catch {
    // If parsing fails, fall back to original payload
  }
  return payload;
}

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
      { enableScripts: true, retainContextWhenHidden: true }
    );

    PairingWebviewPanel.instance = new PairingWebviewPanel(
      panel,
      context,
      sessionManager,
      wsClient
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly sessionManager: SessionManager,
    private readonly wsClient: WsClient
  ) {
    this.panel = panel;

    panel.onDidDispose(
      () => {
        this.disposed = true;
        PairingWebviewPanel.instance = undefined;
      },
      null,
      context.subscriptions
    );

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'revoke') {
        this.sessionManager.revokeSession();
      } else if (msg.command === 'refresh') {
        this.startPairingFlow();
      } else if (msg.command === 'copy') {
        if (typeof msg.text === 'string' && msg.text.length > 0) {
          await vscode.env.clipboard.writeText(msg.text);
          vscode.window.showInformationMessage('CodeLink: Pairing code copied to clipboard');
        }
      }
    });

    this.startPairingFlow();
  }

  private async startPairingFlow(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      this.panel.webview.html = this.loadingHtml('Creating Session...');

      const { sessionId, qrPayload, expiresAt } = await this.sessionManager.createSession();
      const minimalPayload = shortenPairingPayload(qrPayload);

      const qrDataUrl = await qrcode.toDataURL(minimalPayload, {
        errorCorrectionLevel: 'L',
        width: 360,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      if (this.disposed) {
        return;
      }
      this.panel.webview.html = this.pairingHtml(qrDataUrl, expiresAt, minimalPayload);

      const session = await this.sessionManager.waitForMobile(sessionId, 90_000);

      if (this.disposed) {
        return;
      }

      this.wsClient.connect(session.relayWssUrl, session.laptopToken);
      this.panel.webview.html = this.pairedHtml(session.sessionId);
    } catch (err: unknown) {
      if (this.disposed) {
        return;
      }
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

  private pairingHtml(qrDataUrl: string, expiresAt: number, payload: string): string {
    const secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    return this.wrap(`
      <h2>Scan with your phone</h2>
      <div class="qr-wrapper">
        <img src="${qrDataUrl}" width="360" height="360" alt="QR code" />
      </div>
      <p class="muted">Code expires in <span id="countdown">${secondsLeft}</span>s</p>
      <div class="button-row">
        <button id="copy-btn" onclick="copyCode()">Copy pairing code</button>
        <button class="secondary" onclick="refresh()">Refresh QR</button>
      </div>
      <textarea style="width:360px;height:48px;font-size:10px;margin-top:4px;
      background:#1a1a1a;color:#888;border:1px solid #333;border-radius:4px;resize:none;padding:6px;box-sizing:border-box"
      readonly>${payload}</textarea>
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
        function copyCode() {
          vscode.postMessage({ command: 'copy', text: ${JSON.stringify(payload)} });
          const btn = document.getElementById('copy-btn');
          if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy pairing code'; }, 2000);
          }
        }
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
      <p class="muted">${this.escapeHtml(message)}</p>
      <button onclick="refresh()">Try again</button>
      <script>
        const vscode = acquireVsCodeApi();
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    `);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    .qr-wrapper {
      background: #ffffff;
      padding: 12px;
      border-radius: 8px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .qr-wrapper img {
      display: block;
      width: 360px;
      height: 360px;
      border-radius: 4px;
    }
    .button-row {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .muted { color: var(--vscode-descriptionForeground); font-size: 13px; }
    button { background: var(--vscode-button-background);
             color: var(--vscode-button-foreground);
             border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
  </style>
</head>
<body>${body}</body>
</html>`;
  }
}
