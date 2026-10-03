import { Platform } from 'react-native';
import { generateKeyPair, toBase64, fromBase64, KeyPair } from './nobleKx';

const KEYPAIR_STORAGE_KEY = 'codelink.terminal.clientKeyPair';
const PAIRED_HOST_STORAGE_KEY = 'codelink.terminal.pairedHost';

export interface PairedHostInfo {
  hostPublicKey: string; // base64
  deviceId: string;
  pairedAt: number;
  sessionToken?: string;
}

interface SecureStoreModule {
  getItemAsync?: (key: string) => Promise<string | null>;
  setItemAsync?: (key: string, value: string) => Promise<void>;
  deleteItemAsync?: (key: string) => Promise<void>;
}

function getSecureStore(): SecureStoreModule | null {
  try {
    return require('expo-secure-store');
  } catch {
    return null;
  }
}

const memoryFallback = new Map<string, string>();

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const store = getSecureStore();
    if (store && typeof store.getItemAsync === 'function' && Platform?.OS !== 'web') {
      try {
        return await store.getItemAsync(key);
      } catch {
        return null;
      }
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryFallback.get(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const store = getSecureStore();
    if (store && typeof store.setItemAsync === 'function' && Platform?.OS !== 'web') {
      await store.setItemAsync(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    memoryFallback.set(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    const store = getSecureStore();
    if (store && typeof store.deleteItemAsync === 'function' && Platform?.OS !== 'web') {
      await store.deleteItemAsync(key);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
    memoryFallback.delete(key);
  },
};

export class SecureDeviceStore {
  public static async getClientKeyPair(): Promise<KeyPair | null> {
    const raw = await secureStorage.getItem(KEYPAIR_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.publicKey && parsed.privateKey) {
        return {
          publicKey: fromBase64(parsed.publicKey),
          privateKey: fromBase64(parsed.privateKey),
        };
      }
    } catch {
      // malformed
    }
    return null;
  }

  public static async getOrCreateClientKeyPair(): Promise<KeyPair> {
    const existing = await SecureDeviceStore.getClientKeyPair();
    if (existing) {
      return existing;
    }

    const keyPair = generateKeyPair();
    await secureStorage.setItem(
      KEYPAIR_STORAGE_KEY,
      JSON.stringify({
        publicKey: toBase64(keyPair.publicKey),
        privateKey: toBase64(keyPair.privateKey),
        createdAt: Date.now(),
      })
    );
    return keyPair;
  }

  public static async getPairedHost(): Promise<PairedHostInfo | null> {
    const raw = await secureStorage.getItem(PAIRED_HOST_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PairedHostInfo;
    } catch {
      return null;
    }
  }

  public static async setPairedHost(info: PairedHostInfo): Promise<void> {
    await secureStorage.setItem(PAIRED_HOST_STORAGE_KEY, JSON.stringify(info));
  }

  public static async clearPairedHost(): Promise<void> {
    await secureStorage.deleteItem(PAIRED_HOST_STORAGE_KEY);
  }

  public static async reset(): Promise<void> {
    await Promise.all([
      secureStorage.deleteItem(KEYPAIR_STORAGE_KEY),
      secureStorage.deleteItem(PAIRED_HOST_STORAGE_KEY),
    ]);
  }
}
