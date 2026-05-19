import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const storage = {
    async getItemAsync(key: string): Promise<string | null> {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        }
        return SecureStore.getItemAsync(key);
    },
    async setItemAsync(key: string, value: string): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
            return;
        }
        return SecureStore.setItemAsync(key, value);
    },
    async deleteItemAsync(key: string): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
            return;
        }
        return SecureStore.deleteItemAsync(key);
    },
};

const TOKEN_KEY = 'codelink.mobileToken';
const SESSION_KEY = 'codelink.sessionId';
const RELAY_KEY = 'codelink.relayWss';
const DEVICE_ID_KEY = 'codelink.deviceId';

export interface StoredSession {
    mobileToken: string;
    sessionId: string;
    relayWss: string;
}

export async function getDeviceId(): Promise<string> {
    const existing = await storage.getItemAsync(DEVICE_ID_KEY);
    if (existing) { return existing; }
    const id = 'mob_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    await storage.setItemAsync(DEVICE_ID_KEY, id);
    return id;
}

export async function joinSession(
    authUrl: string,
    sessionId: string,
    challenge: string,
    mobileDeviceId: string,
): Promise<StoredSession> {
    const resp = await fetch(`${authUrl}/v1/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, mobileDeviceId }),
    })

    if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Join failed: ${resp.status}`);
    }

    const data = await resp.json() as {
        mobileToken: string;
        relayWss: string;
        sessionId: string;
    };

    await storage.setItemAsync(TOKEN_KEY, data.mobileToken);
    await storage.setItemAsync(SESSION_KEY, data.sessionId);
    await storage.setItemAsync(RELAY_KEY, data.relayWss);

    return { mobileToken: data.mobileToken, sessionId: data.sessionId, relayWss: data.relayWss };
}

export async function getStoredSession(): Promise<StoredSession | null> {
    const [mobileToken, sessionId, relayWss] = await Promise.all([
        storage.getItemAsync(TOKEN_KEY),
        storage.getItemAsync(SESSION_KEY),
        storage.getItemAsync(RELAY_KEY),
    ]);
    if (!mobileToken || !sessionId || !relayWss) { return null };
    return { mobileToken, sessionId, relayWss };
}

export async function clearStoredSession(): Promise<void> {
    await Promise.all([
        storage.deleteItemAsync(TOKEN_KEY),
        storage.deleteItemAsync(SESSION_KEY),
        storage.deleteItemAsync(RELAY_KEY),
    ]);
}