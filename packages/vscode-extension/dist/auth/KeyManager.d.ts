import * as vscode from 'vscode';
export declare class KeyManager {
    private readonly secrets;
    constructor(secrets: vscode.SecretStorage);
    getOrCreateKeyPair(): Promise<{
        privateKeyPem: string;
        publicKeyPem: string;
    }>;
    getPublicKeyPem(): Promise<string>;
    signRequest(body: string): Promise<string>;
}
//# sourceMappingURL=KeyManager.d.ts.map