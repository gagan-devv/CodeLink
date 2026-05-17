import * as vscode from 'vscode';
import { createSign, generateKeyPairSync, sign } from 'crypto';

const PRIVATE_KEY_SECRET = 'codelink.rsa.privateKey';
const PUBLIC_KEY_SECRET = 'codelink.rsa.publicKey';

export class KeyManager {
    constructor(private readonly secrets: vscode.SecretStorage) {}

    async getOrCreateKeyPair() : Promise<{ privateKeyPem: string, publicKeyPem: string }> {
        let privateKeyPem = await this.secrets.get(PRIVATE_KEY_SECRET);
        let publicKeyPem = await this.secrets.get(PUBLIC_KEY_SECRET);

        if (!privateKeyPem || !publicKeyPem) {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding:{ type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            });

            privateKeyPem = privateKey;
            publicKeyPem = publicKey;

            await this.secrets.store(PRIVATE_KEY_SECRET, privateKeyPem);
            await this.secrets.store(PUBLIC_KEY_SECRET, publicKeyPem);
        }

        return { privateKeyPem, publicKeyPem };
    }

    async getPublicKeyPem(): Promise<string> {
        const { publicKeyPem } = await this.getOrCreateKeyPair();
        return publicKeyPem;
    }

    async signRequest(body: string): Promise<string> {
        const { privateKeyPem } = await this.getOrCreateKeyPair();
        const signer = createSign('SHA256');
        signer.update(body);
        return signer.sign(privateKeyPem, 'base64');
    }
}