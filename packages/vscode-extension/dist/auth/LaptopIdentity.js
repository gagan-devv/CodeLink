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
exports.LaptopIdentity = void 0;
const vscode = __importStar(require("vscode"));
const LAPTOP_ID_KEY = 'codelink.laptopId';
class LaptopIdentity {
    constructor(keyManager, globalState) {
        this.keyManager = keyManager;
        this.globalState = globalState;
    }
    async ensureRegistered() {
        const cached = this.globalState.get(LAPTOP_ID_KEY);
        if (cached) {
            return cached;
        }
        return this.register();
    }
    async register() {
        const authUrl = this.getAuthUrl();
        const publicKeyPem = await this.keyManager.getPublicKeyPem();
        const response = await fetch(`${authUrl}/v1/laptops/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKeyPem }),
        });
        if (!response.ok) {
            throw new Error(`Laptop registration failed: ${response.status} ${response.statusText}`);
        }
        const { laptopId } = await response.json();
        await this.globalState.update(LAPTOP_ID_KEY, laptopId);
        return laptopId;
    }
    getLaptopId() {
        return this.globalState.get(LAPTOP_ID_KEY);
    }
    getAuthUrl() {
        return vscode.workspace
            .getConfiguration('codelink')
            .get('authServiceUrl', 'http://localhost:8081');
    }
}
exports.LaptopIdentity = LaptopIdentity;
//# sourceMappingURL=LaptopIdentity.js.map