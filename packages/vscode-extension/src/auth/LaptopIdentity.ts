import * as vscode from 'vscode';
import { KeyManager } from './KeyManager';
import { authFetch } from './authClient';

const LAPTOP_ID_KEY = 'codelink.laptopId';

export class LaptopIdentity {
  constructor(
    private readonly keyManager: KeyManager,
    private readonly globalState: vscode.Memento
  ) {}

  async ensureRegistered(): Promise<string> {
    const cached = this.globalState.get<string>(LAPTOP_ID_KEY);
    if (cached) {
      return cached;
    }
    return this.register();
  }

  async clearIdentity(): Promise<void> {
    await this.globalState.update(LAPTOP_ID_KEY, undefined);
  }

  async reRegister(): Promise<string> {
    await this.clearIdentity();
    await this.keyManager.clearKeys();
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
    return laptopId;
  }

  getLaptopId(): string | undefined {
    return this.globalState.get<string>(LAPTOP_ID_KEY);
  }

  private getAuthUrl(): string {
    return vscode.workspace
      .getConfiguration('codelink')
      .get<string>('authServiceUrl', 'http://localhost:8081');
  }
}
