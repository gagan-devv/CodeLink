import * as vscode from 'vscode';
import { KeyManager } from './KeyManager';
import { authFetch } from './authClient';

const LAPTOP_ID_KEY = 'codelink.laptopId';
const AUTH_SERVICE_URL_KEY = 'codelink.authServiceUrl';

export class LaptopIdentity {
  constructor(
    private readonly keyManager: KeyManager,
    private readonly globalState: vscode.Memento
  ) {}

  async ensureRegistered(): Promise<string> {
    const currentAuthUrl = this.getAuthUrl();
    const storedAuthUrl = this.globalState.get<string>(AUTH_SERVICE_URL_KEY);
    const cachedId = this.globalState.get<string>(LAPTOP_ID_KEY);

    // If authServiceUrl was stored and differs from the current configuration, automatically reset
    if (storedAuthUrl && storedAuthUrl !== currentAuthUrl) {
      await this.resetIdentity();
      return this.register();
    }

    if (cachedId) {
      if (!storedAuthUrl) {
        await this.globalState.update(AUTH_SERVICE_URL_KEY, currentAuthUrl);
      }
      return cachedId;
    }

    return this.register();
  }

  async clearIdentity(): Promise<void> {
    await this.globalState.update(LAPTOP_ID_KEY, undefined);
    await this.globalState.update(AUTH_SERVICE_URL_KEY, undefined);
  }

  async resetIdentity(): Promise<void> {
    await this.clearIdentity();
    await this.keyManager.clearKeys();
  }

  async reRegister(): Promise<string> {
    await this.resetIdentity();
    return this.register();
  }

  private async register(): Promise<string> {
    const authUrl = this.getAuthUrl();
    const publicKeyPem = await this.keyManager.getPublicKeyPem();

    const response = await authFetch<{ laptopId: string }>(`${authUrl}/v1/laptops/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKeyPem }),
      authUrl,
      laptopId: '(none)',
    });

    if (!response.ok) {
      throw new Error(`Laptop registration failed (${response.status}): ${response.bodyText}`);
    }

    const { laptopId } = await response.json();
    await this.globalState.update(LAPTOP_ID_KEY, laptopId);
    await this.globalState.update(AUTH_SERVICE_URL_KEY, authUrl);
    return laptopId;
  }

  getLaptopId(): string | undefined {
    return this.globalState.get<string>(LAPTOP_ID_KEY);
  }

  getStoredAuthUrl(): string | undefined {
    return this.globalState.get<string>(AUTH_SERVICE_URL_KEY);
  }

  private getAuthUrl(): string {
    return vscode.workspace
      .getConfiguration('codelink')
      .get<string>('authServiceUrl', 'http://localhost:8081');
  }
}
