import * as vscode from 'vscode';
import { KeyManager } from './KeyManager';

export type SessionState = 'idle' | 'pending' | 'active' | 'revoked';

export interface ActiveSession {
  sessionId: string;
  laptopToken: string;
  relayWssUrl: string;
}

export class SessionManager {
  private _state: SessionState = 'idle';
  private _session: ActiveSession | null = null;
  private _pollTimer: NodeJS.Timeout | null = null;

  private readonly _onStateChange = new vscode.EventEmitter<SessionState>();
  readonly onStateChange = this._onStateChange.event;

  constructor(
    private readonly keyManager: KeyManager,
    private readonly laptopId: string
  ) {}

  get state(): SessionState {
    return this._state;
  }
  get session(): ActiveSession | null {
    return this._session;
  }

  async createSession(): Promise<{ sessionId: string; qrPayload: string; expiresAt: number }> {
    const authUrl = this.getAuthUrl();
    const requestedAt = Date.now();
    const body = JSON.stringify({ laptopId: this.laptopId, requestedAt });
    const sig = await this.keyManager.signRequest(body);

    const response = await fetch(`${authUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Laptop-Id': this.laptopId,
        'X-Laptop-Sig': sig,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      sessionId: string;
      qrPayload: string;
      expiresAt: number;
    };

    this._state = 'pending';
    this._onStateChange.fire('pending');
    return data;
  }

  async waitForMobile(sessionId: string, timeoutMs = 90_000): Promise<ActiveSession> {
    const authUrl = this.getAuthUrl();
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (Date.now() > deadline) {
          this._setState('idle');
          return reject(new Error('Pairing timed out - QR code expired'));
        }

        try {
          const sig = await this.keyManager.signRequest('');
          const response = await fetch(`${authUrl}/v1/sessions/${sessionId}/status`, {
            headers: {
              'X-Laptop-Id': this.laptopId,
              'X-Laptop-Sig': sig,
            },
          });

          if (!response.ok) {
            return reject(new Error(`Status poll failed: ${response.status}`));
          }

          const data = (await response.json()) as {
            state: string;
            laptopToken: string | null;
          };

          if (data.state === 'active' && data.laptopToken) {
            const relayBase = vscode.workspace
              .getConfiguration('codelink')
              .get<string>('relayServiceUrl', 'ws://localhost:8082');

            const session: ActiveSession = {
              sessionId,
              laptopToken: data.laptopToken,
              relayWssUrl: `${relayBase}/ws`,
            };
            this._session = session;
            this._setState('active');
            return resolve(session);
          }
        } catch (err) {
          reject(err);
        }
      };
      poll();
    });
  }

  async revokeSession(): Promise<void> {
    if (!this._session) {
      return;
    }

    const authUrl = this.getAuthUrl();
    const sig = await this.keyManager.signRequest('');

    await fetch(`${authUrl}/v1/sessions/${this._session.sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-Laptop-Id': this.laptopId,
        'X-Laptop-Sig': sig,
      },
    });

    this._session = null;
    this._setState('revoked');
    setTimeout(() => this._setState('idle'), 1_000);
  }

  dispose(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
    }
    this._onStateChange.dispose();
  }

  private _setState(state: SessionState): void {
    this._state = state;
    this._onStateChange.fire(state);
  }

  private getAuthUrl(): string {
    return vscode.workspace
      .getConfiguration('codelink')
      .get<string>('authServiceUrl', 'http://localhost:8081');
  }
}
