import * as vscode from 'vscode';
import { KeyManager } from './KeyManager';
import { LaptopIdentity } from './LaptopIdentity';
import { authFetch } from './authClient';

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

  constructor(
    private readonly keyManager: KeyManager,
    private laptopId: string,
    private readonly laptopIdentity?: LaptopIdentity
  ) {}

  updateLaptopId(newLaptopId: string): void {
    this.laptopId = newLaptopId;
  }

  get state(): SessionState {
    return this._state;
  }
  get session(): ActiveSession | null {
    return this._session;
  }

  async createSession(
    retryOnNotFound = true
  ): Promise<{ sessionId: string; qrPayload: string; expiresAt: number }> {
    if (this.laptopIdentity && !this.laptopId) {
      this.laptopId = await this.laptopIdentity.ensureRegistered();
    }

    const authUrl = this.getAuthUrl();
    const requestedAt = Date.now();
    const body = JSON.stringify({ laptopId: this.laptopId, requestedAt });
    const sig = await this.keyManager.signRequest(body);

    const response = await authFetch<{
      sessionId: string;
      qrPayload: string;
      expiresAt: number;
    }>(`${authUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Laptop-Id': this.laptopId,
        'X-Laptop-Sig': sig,
      },
      body,
      authUrl,
      laptopId: this.laptopId,
    });

    if (!response.ok) {
      if (response.status === 401 && retryOnNotFound && this.laptopIdentity) {
        let isLaptopNotFound = false;
        try {
          const errData = JSON.parse(response.bodyText) as { reason?: string };
          if (errData.reason === 'laptop not found') {
            isLaptopNotFound = true;
          }
        } catch {
          // not JSON
        }

        if (isLaptopNotFound) {
          const newLaptopId = await this.laptopIdentity.reRegister();
          this.updateLaptopId(newLaptopId);
          return this.createSession(false);
        }
      }

      const truncatedBody =
        response.bodyText.length > 500
          ? response.bodyText.slice(0, 500) + '...'
          : response.bodyText;
      throw new Error(`Session creation failed (${response.status}): ${truncatedBody}`);
    }

    const data = await response.json();

    this._setState('pending');
    return data;
  }

  async waitForMobile(sessionId: string, timeoutMs = 90_000): Promise<ActiveSession> {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }

    const authUrl = this.getAuthUrl();
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (Date.now() >= deadline) {
          if (this._pollTimer) {
            clearTimeout(this._pollTimer);
            this._pollTimer = null;
          }
          this._setState('idle');
          return reject(new Error('Pairing timed out - QR code expired'));
        }

        try {
          const sig = await this.keyManager.signRequest('');
          const response = await authFetch<{
            state: string;
            laptopToken: string | null;
          }>(`${authUrl}/v1/sessions/${sessionId}/status`, {
            headers: {
              'X-Laptop-Id': this.laptopId,
              'X-Laptop-Sig': sig,
            },
            authUrl,
            laptopId: this.laptopId,
          });

          if (!response.ok) {
            if (this._pollTimer) {
              clearTimeout(this._pollTimer);
              this._pollTimer = null;
            }
            return reject(
              new Error(`Status poll failed (${response.status}): ${response.bodyText}`)
            );
          }

          const data = await response.json();

          if (data.state === 'active' && data.laptopToken) {
            if (this._pollTimer) {
              clearTimeout(this._pollTimer);
              this._pollTimer = null;
            }
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

          this._pollTimer = setTimeout(poll, 2000);
        } catch (err) {
          if (this._pollTimer) {
            clearTimeout(this._pollTimer);
            this._pollTimer = null;
          }
          reject(err);
        }
      };
      poll();
    });
  }

  async revokeSession(): Promise<void> {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }

    if (!this._session) {
      return;
    }

    const authUrl = this.getAuthUrl();
    const sig = await this.keyManager.signRequest('');

    await authFetch(`${authUrl}/v1/sessions/${this._session.sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-Laptop-Id': this.laptopId,
        'X-Laptop-Sig': sig,
      },
      authUrl,
      laptopId: this.laptopId,
    });

    this._session = null;
    this._setState('revoked');
    setTimeout(() => this._setState('idle'), 1_000);
  }

  dispose(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _setState(state: SessionState): void {
    this._state = state;
  }

  private getAuthUrl(): string {
    return vscode.workspace
      .getConfiguration('codelink')
      .get<string>('authServiceUrl', 'http://localhost:8081');
  }
}
