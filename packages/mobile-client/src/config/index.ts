import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RELAY_SERVER_URL_STORAGE_KEY = '@codelink/relay_server_url';
// Use http:// for Socket.IO client to connect to the relay server reliably
export const DEFAULT_RELAY_SERVER_URL = 'http://localhost:8080';

/**
 * Application configuration interface
 */
export interface AppConfig {
  relayServerUrl: string;
  socketOptions: {
    reconnection: boolean;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    timeout: number;
  };
  ui: {
    maxPromptLength: number;
    diffHistoryLimit: number;
    notificationDuration: number;
  };
}

/**
 * Get relay server URL from environment or configuration
 * Priority: Environment variable > app.json extra > default
 */
const getRelayServerUrl = (): string => {
  // Expo statically exposes EXPO_PUBLIC_* vars to app code
  if (process.env.EXPO_PUBLIC_RELAY_SERVER_URL) {
    return process.env.EXPO_PUBLIC_RELAY_SERVER_URL;
  }

  // Check for environment variable (for development/testing)
  if (process.env.RELAY_SERVER_URL) {
    return process.env.RELAY_SERVER_URL;
  }

  // Check Expo Constants for app.json extra configuration
  const expoConfig = Constants.expoConfig;
  if (expoConfig?.extra?.relayServerUrl) {
    return expoConfig.extra.relayServerUrl;
  }

  // Fallback to default
  return DEFAULT_RELAY_SERVER_URL;
};

/**
 * Default application configuration
 *
 * Configuration values:
 * - relayServerUrl: WebSocket URL for the relay server
 * - socketOptions.reconnection: Enable automatic reconnection
 * - socketOptions.reconnectionAttempts: Maximum reconnection attempts (Requirement 8.4)
 * - socketOptions.reconnectionDelay: Delay between reconnection attempts in ms
 * - socketOptions.timeout: Connection timeout in ms
 * - ui.maxPromptLength: Maximum characters allowed in a prompt
 * - ui.diffHistoryLimit: Maximum number of diffs to keep in history
 * - ui.notificationDuration: Duration to show notifications in ms
 */
export const defaultConfig: AppConfig = {
  relayServerUrl: getRelayServerUrl(),
  socketOptions: {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
  },
  ui: {
    maxPromptLength: 5000,
    diffHistoryLimit: 50,
    notificationDuration: 4000,
  },
};

/**
 * Get the current application configuration
 * @returns AppConfig object with all configuration values
 */
export const getConfig = (): AppConfig => {
  return defaultConfig;
};

/**
 * Load any user-saved relay URL override from AsyncStorage.
 */
export const loadRelayServerUrlOverride = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(RELAY_SERVER_URL_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load relay server URL override:', error);
    return null;
  }
};

/**
 * Persist a user-saved relay URL override for this device.
 */
export const saveRelayServerUrlOverride = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(RELAY_SERVER_URL_STORAGE_KEY, url);
  } catch (error) {
    console.error('Failed to save relay server URL override:', error);
    throw error;
  }
};

/**
 * Update configuration at runtime (useful for testing)
 * @param updates Partial configuration updates to apply
 * @returns Updated AppConfig object
 */
export const updateConfig = (updates: Partial<AppConfig>): AppConfig => {
  Object.assign(defaultConfig, updates);
  return defaultConfig;
};
