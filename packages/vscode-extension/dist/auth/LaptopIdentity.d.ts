import * as vscode from 'vscode';
import { KeyManager } from './KeyManager';
export declare class LaptopIdentity {
    private readonly keyManager;
    private readonly globalState;
    constructor(keyManager: KeyManager, globalState: vscode.Memento);
    ensureRegistered(): Promise<string>;
    private register;
    getLaptopId(): string | undefined;
    private getAuthUrl;
}
//# sourceMappingURL=LaptopIdentity.d.ts.map