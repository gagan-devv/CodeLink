import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createSign } from 'crypto';
import { RelayClient } from './RelayClient';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PairingManager, KeyPair } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';

export interface ActiveSessionConfig {
  sessionId: string;
  relayWssUrl?: string;
  authUrl?: string;
  laptopId?: string;
  privateKeyPem?: string;
  updatedAt?: number;
}

export interface LaptopIdentityConfig {
  laptopId: string;
  privateKeyPem: string;
  publicKeyPem?: string;
  authUrl?: string;
  updatedAt?: number;
}

export interface CompanionTokenResponse {
  companionToken: string;
  sessionId: string;
  relayWss: string;
  expiresAt: number; // Unix timestamp in seconds
}

export function getCodeLinkDir(): string {
  return path.join(os.homedir(), '.codelink');
}

export function getActiveSessionFilePath(): string {
  return path.join(getCodeLinkDir(), 'active_session.json');
}

export function getLaptopIdentityFilePath(): string {
  return path.join(getCodeLinkDir(), 'laptop_identity.json');
}

export function loadPersistedSession(): ActiveSessionConfig | null {
  const filePath = getActiveSessionFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as ActiveSessionConfig;
    }
  } catch {
    // ignore parse/read errors
  }
  return null;
}

export function loadPersistedIdentity(): LaptopIdentityConfig | null {
  const filePath = getLaptopIdentityFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as LaptopIdentityConfig;
    }
  } catch {
    // ignore parse/read errors
  }
  return null;
}

export function savePersistedSession(session: ActiveSessionConfig): void {
  const dir = getCodeLinkDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(getActiveSessionFilePath(), JSON.stringify(session, null, 2), {
    mode: 0o600,
    encoding: 'utf8',
  });
}

export function clearPersistedSession(): void {
  const filePath = getActiveSessionFilePath();
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

export async function requestCompanionToken(
  authUrl: string,
  sessionId: string,
  laptopId: string,
  privateKeyPem: string
): Promise<CompanionTokenResponse> {
  const body = '{}';
  const signer = createSign('SHA256');
  signer.update(body);
  const sig = signer.sign(privateKeyPem, 'base64');

  const cleanAuthUrl = authUrl.replace(/\/+$/, '');
  const url = `${cleanAuthUrl}/v1/sessions/${encodeURIComponent(sessionId)}/companion-token`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Laptop-Id': laptopId,
      'X-Laptop-Sig': sig,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to obtain companion token (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as CompanionTokenResponse;
  if (!data.companionToken) {
    throw new Error('Auth service response missing companionToken');
  }
  return data;
}

export class DaemonRelayManager {
  private relayClient: RelayClient | null = null;
  private activeSession: ActiveSessionConfig | null = null;
  private laptopIdentity: LaptopIdentityConfig | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private reconnectBackoffTimer: NodeJS.Timeout | null = null;
  private currentToken: string | null = null;
  private tokenExpiresAt = 0;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private lastError: string | null = null;

  constructor(
    private config: CompanionConfig,
    private sessionTable: SessionTable,
    private pairingManager: PairingManager,
    private deviceStore: PairedDeviceStore,
    private hostKeyPair: KeyPair,
    private defaultAuthUrl: string = 'http://localhost:8081',
    private defaultRelayUrl: string = 'ws://localhost:8082/ws'
  ) {}

  public getRelayClient(): RelayClient | null {
    return this.relayClient;
  }

  public isConnected(): boolean {
    return this.relayClient !== null && this.relayClient.isConnected();
  }

  public getActiveSession(): ActiveSessionConfig | null {
    return this.activeSession;
  }

  public getStatusDetails(): {
    enabled: boolean;
    activeSessionId: string | null;
    relayConnected: boolean;
    lastError: string | null;
  } {
    return {
      enabled: this.config.isEnabled(),
      activeSessionId: this.activeSession?.sessionId ?? null,
      relayConnected: this.isConnected(),
      lastError: this.lastError,
    };
  }

  public async autoAttachIfAvailable(): Promise<boolean> {
    if (!this.config.isEnabled()) {
      return false;
    }

    const session = loadPersistedSession();
    if (!session || !session.sessionId) {
      return false;
    }

    const identity = loadPersistedIdentity();
    await this.attachSession(session, identity || undefined);
    return true;
  }

  public async attachSession(
    session: ActiveSessionConfig,
    identity?: LaptopIdentityConfig
  ): Promise<void> {
    if (this.activeSession && this.activeSession.sessionId !== session.sessionId) {
      this.pairingManager?.invalidateForRelaySession(this.activeSession.sessionId);
    }
    this.activeSession = { ...session };

    if (identity) {
      this.laptopIdentity = { ...identity };
    } else if (!this.laptopIdentity) {
      this.laptopIdentity = loadPersistedIdentity();
    }

    // Persist active session configuration
    savePersistedSession(this.activeSession);

    if (!this.config.isEnabled()) {
      console.log(
        '[DaemonRelayManager] Terminal feature disabled; active session stored but not connecting to relay.'
      );
      return;
    }

    await this.connectWithBackoff();
  }

  public async detachSession(): Promise<void> {
    this.clearTimers();
    this.activeSession = null;
    this.currentToken = null;
    this.tokenExpiresAt = 0;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.pairingManager?.clearAllPending();
    clearPersistedSession();

    if (this.relayClient) {
      this.relayClient.disconnect();
      this.relayClient = null;
    }
    console.log('[DaemonRelayManager] Detached session and closed relay client.');
  }

  private clearTimers(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.reconnectBackoffTimer) {
      clearTimeout(this.reconnectBackoffTimer);
      this.reconnectBackoffTimer = null;
    }
  }

  private async fetchFreshToken(): Promise<CompanionTokenResponse> {
    if (!this.activeSession) {
      throw new Error('No active session configured to fetch companion token');
    }

    const laptopId = this.activeSession.laptopId || this.laptopIdentity?.laptopId;
    const privateKeyPem = this.activeSession.privateKeyPem || this.laptopIdentity?.privateKeyPem;
    const authUrl =
      this.activeSession.authUrl || this.laptopIdentity?.authUrl || this.defaultAuthUrl;

    if (!laptopId || !privateKeyPem) {
      throw new Error(
        'Laptop identity credentials (laptopId and privateKeyPem) missing for companion token'
      );
    }

    const resp = await requestCompanionToken(
      authUrl,
      this.activeSession.sessionId,
      laptopId,
      privateKeyPem
    );

    this.currentToken = resp.companionToken;
    this.tokenExpiresAt = resp.expiresAt;
    console.log(
      `[DaemonRelayManager] Obtained companion token for session ${this.activeSession.sessionId} (valid until ${new Date(
        resp.expiresAt * 1000
      ).toISOString()})`
    );

    this.scheduleTokenRefresh(resp.expiresAt);
    return resp;
  }

  private scheduleTokenRefresh(expiresAtSeconds: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const msUntilExpiry = expiresAtSeconds * 1000 - Date.now();
    // Refresh 5 minutes before 1h expiry, or at minimum in 15 seconds
    const refreshDelay = Math.max(15_000, msUntilExpiry - 5 * 60 * 1000);

    this.refreshTimer = setTimeout(async () => {
      if (!this.activeSession || !this.config.isEnabled()) {
        return;
      }
      try {
        console.log('[DaemonRelayManager] Refreshing companion token before expiry...');
        await this.fetchFreshToken();
        // Reconnect with new token
        if (this.relayClient) {
          this.relayClient.disconnect();
          await this.relayClient.connect();
        }
      } catch (err) {
        console.error(
          '[DaemonRelayManager] Failed to refresh companion token:',
          err instanceof Error ? err.message : String(err)
        );
        // Retry refreshing in 30 seconds
        this.scheduleTokenRefresh(Math.floor((Date.now() + 30_000) / 1000));
      }
    }, refreshDelay);
  }

  private async getValidToken(): Promise<string> {
    const isCloseToExpiry = this.tokenExpiresAt * 1000 - Date.now() < 60_000;
    if (!this.currentToken || isCloseToExpiry) {
      const resp = await this.fetchFreshToken();
      return resp.companionToken;
    }
    return this.currentToken;
  }

  public async connectWithBackoff(): Promise<void> {
    if (this.isConnecting || !this.activeSession || !this.config.isEnabled()) {
      return;
    }

    this.isConnecting = true;
    try {
      const tokenResp = await this.fetchFreshToken();
      const relayUrl = this.activeSession.relayWssUrl || tokenResp.relayWss || this.defaultRelayUrl;

      if (this.relayClient) {
        this.relayClient.disconnect();
        this.relayClient = null;
      }

      this.relayClient = new RelayClient({
        relayUrl,
        token: () => this.getValidToken(),
        config: this.config,
        sessionTable: this.sessionTable,
        pairingManager: this.pairingManager,
        deviceStore: this.deviceStore,
        hostKeyPair: this.hostKeyPair,
        relaySessionId: this.activeSession.sessionId,
        onConnected: () => {
          this.reconnectAttempts = 0;
          this.lastError = null;
          console.log('[DaemonRelayManager] RelayClient connected successfully.');
        },
        onDisconnected: (code, reason) => {
          console.log(
            `[DaemonRelayManager] RelayClient disconnected (code: ${code}, reason: ${reason || 'none'}).`
          );
        },
        onError: (err) => {
          const sanitized = (err.message || 'RelayClient error')
            .replace(/(?:bearer\s+|token[=:]\s*)[a-zA-Z0-9_\-.]+/gi, 'token=[REDACTED]')
            .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED KEY]');
          this.lastError = sanitized;
          console.error('[DaemonRelayManager] RelayClient error:', sanitized);
        },
      });

      await this.relayClient.connect();
      this.reconnectAttempts = 0;
      this.lastError = null;
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const sanitized = rawMsg
        .replace(/(?:bearer\s+|token[=:]\s*)[a-zA-Z0-9_\-.]+/gi, 'token=[REDACTED]')
        .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED KEY]');
      this.lastError = sanitized;
      console.error('[DaemonRelayManager] Connection attempt failed:', sanitized);
      this.scheduleReconnectBackoff();
    } finally {
      this.isConnecting = false;
    }
  }

  private scheduleReconnectBackoff(): void {
    if (this.reconnectBackoffTimer) {
      clearTimeout(this.reconnectBackoffTimer);
      this.reconnectBackoffTimer = null;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5)));
    console.log(
      `[DaemonRelayManager] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})...`
    );

    this.reconnectBackoffTimer = setTimeout(() => {
      this.connectWithBackoff();
    }, delay);
  }

  public async shutdown(): Promise<void> {
    this.clearTimers();
    if (this.relayClient) {
      this.relayClient.disconnect();
      this.relayClient = null;
    }
  }
}
