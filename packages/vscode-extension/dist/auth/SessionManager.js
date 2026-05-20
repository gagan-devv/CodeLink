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
exports.SessionManager = void 0;
const vscode = __importStar(require("vscode"));
class SessionManager {
    constructor(keyManager, laptopId) {
        this.keyManager = keyManager;
        this.laptopId = laptopId;
        this._state = 'idle';
        this._session = null;
        this._pollTimer = null;
        this._onStateChange = new vscode.EventEmitter();
        this.onStateChange = this._onStateChange.event;
    }
    get state() { return this._state; }
    get session() { return this._session; }
    async createSession() {
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
        const data = await response.json();
        this._state = 'pending';
        this._onStateChange.fire('pending');
        return data;
    }
    async waitForMobile(sessionId, timeoutMs = 90000) {
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
                    const data = await response.json();
                    if (data.state === 'active' && data.laptopToken) {
                        const relayBase = vscode.workspace
                            .getConfiguration('codelink')
                            .get('relayServiceUrl', 'ws://localhost:8082');
                        const session = {
                            sessionId,
                            laptopToken: data.laptopToken,
                            relayWssUrl: `${relayBase}/ws`
                        };
                        this._session = session;
                        this._setState('active');
                        return resolve(session);
                    }
                }
                catch (err) {
                    reject(err);
                }
            };
            poll();
        });
    }
    async revokeSession() {
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
        setTimeout(() => this._setState('idle'), 1000);
    }
    dispose() {
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
        }
        this._onStateChange.dispose();
    }
    _setState(state) {
        this._state = state;
        this._onStateChange.fire(state);
    }
    getAuthUrl() {
        return vscode.workspace
            .getConfiguration('codelink')
            .get('authServiceUrl', 'http://localhost:8081');
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=SessionManager.js.map