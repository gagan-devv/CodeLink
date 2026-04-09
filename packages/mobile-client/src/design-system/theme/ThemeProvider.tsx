/**
 * Theme Provider Component
 *
 * Provides theme configuration to the entire app via React Context.
 * Handles theme persistence with AsyncStorage and theme updates.
 *
 * Requirements: 1.6, 20.1, 20.5, 20.6, 20.7
 */

import React, { useState, useEffect, useMemo, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './ThemeContext';
import { createTheme } from './createTheme';
import { defaultThemeConfiguration, type ThemeConfiguration } from './types';

/**
 * AsyncStorage key for theme configuration persistence
 */
const THEME_STORAGE_KEY = '@codelink/theme_config';

/**
 * ThemeProvider props
 */
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Loads theme configuration from AsyncStorage.
 * Returns default configuration if storage is unavailable or empty.
 */
async function loadThemeConfiguration(): Promise<ThemeConfiguration> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ThemeConfiguration;
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load theme configuration from AsyncStorage:', error);
  }
  return defaultThemeConfiguration;
}

/**
 * Saves theme configuration to AsyncStorage.
 */
async function saveThemeConfiguration(config: ThemeConfiguration): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save theme configuration to AsyncStorage:', error);
  }
}

/**
 * ThemeProvider component wraps the app and provides theme configuration
 * via React Context. Handles loading and persisting theme preferences.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [config, setConfigState] = useState<ThemeConfiguration>(defaultThemeConfiguration);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme configuration on mount
  useEffect(() => {
    loadThemeConfiguration()
      .then((loadedConfig) => {
        setConfigState(loadedConfig);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Create theme object from configuration
  // Memoized to avoid unnecessary recalculations
  const theme = useMemo(() => createTheme(config), [config]);

  // Update configuration and persist to AsyncStorage
  const setConfig = (newConfig: ThemeConfiguration) => {
    setConfigState(newConfig);
    // Save asynchronously without blocking UI
    saveThemeConfiguration(newConfig).catch((error) => {
      console.error('Failed to persist theme configuration:', error);
    });
  };

  // Context value with theme, config, and setter
  const contextValue = useMemo(
    () => ({
      theme,
      config,
      setConfig,
    }),
    [theme, config]
  );

  // Show nothing while loading theme preferences
  // This prevents flash of default theme before loading saved preferences
  if (isLoading) {
    return null;
  }

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};
