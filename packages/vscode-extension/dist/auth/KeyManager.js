"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyManager = void 0;
const crypto_1 = require("crypto");
const PRIVATE_KEY_SECRET = 'codelink.rsa.privateKey';
const PUBLIC_KEY_SECRET = 'codelink.rsa.publicKey';
class KeyManager {
    constructor(secrets) {
        this.secrets = secrets;
    }
    async getOrCreateKeyPair() {
        let privateKeyPem = await this.secrets.get(PRIVATE_KEY_SECRET);
        let publicKeyPem = await this.secrets.get(PUBLIC_KEY_SECRET);
        if (!privateKeyPem || !publicKeyPem) {
            const { privateKey, publicKey } = (0, crypto_1.generateKeyPairSync)('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            });
            privateKeyPem = privateKey;
            publicKeyPem = publicKey;
            await this.secrets.store(PRIVATE_KEY_SECRET, privateKeyPem);
            await this.secrets.store(PUBLIC_KEY_SECRET, publicKeyPem);
        }
        return { privateKeyPem, publicKeyPem };
    }
    async getPublicKeyPem() {
        const { publicKeyPem } = await this.getOrCreateKeyPair();
        return publicKeyPem;
    }
    async signRequest(body) {
        const { privateKeyPem } = await this.getOrCreateKeyPair();
        const signer = (0, crypto_1.createSign)('SHA256');
        signer.update(body);
        return signer.sign(privateKeyPem, 'base64');
    }
}
exports.KeyManager = KeyManager;
//# sourceMappingURL=KeyManager.js.map