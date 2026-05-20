import * as vscode from 'vscode';
import { KeyManager } from './KeyManager';
export type SessionState = 'idle' | 'pending' | 'active' | 'revoked';
export interface ActiveSession {
    sessionId: string;
    laptopToken: string;
    relayWssUrl: string;
}
export declare class SessionManager {
    private readonly keyManager;
    private readonly laptopId;
    private _state;
    private _session;
    private _pollTimer;
    private readonly _onStateChange;
    readonly onStateChange: vscode.Event<SessionState>;
    constructor(keyManager: KeyManager, laptopId: string);
    get state(): SessionState;
    get session(): ActiveSession | null;
    createSession(): Promise<{
        sessionId: string;
        qrPayload: string;
        expiresAt: number;
    }>;
    waitForMobile(sessionId: string, timeoutMs?: number): Promise<ActiveSession>;
    revokeSession(): Promise<void>;
    dispose(): void;
    private _setState;
    private getAuthUrl;
}
//# sourceMappingURL=SessionManager.d.ts.map