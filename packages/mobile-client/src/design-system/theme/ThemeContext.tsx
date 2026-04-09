/**
 * Theme Context
 *
 * React Context for theme configuration and management.
 * Provides theme access throughout the component tree.
 *
 * Requirements: 1.6
 */

import { createContext } from 'react';
import type { ThemeConfig, ThemeConfiguration } from './types';
import { defaultThemeConfiguration } from './types';
import { createTheme } from './createTheme';

/**
 * ThemeContextValue interface defines the shape of the theme context.
 * Provides access to the current theme and configuration update function.
 */
export interface ThemeContextValue {
  /**
   * Current theme object with all design tokens
   */
  theme: ThemeConfig;

  /**
   * Current theme configuration (user preferences)
   */
  config: ThemeConfiguration;

  /**
   * Function to update theme configuration
   */
  setConfig: (config: ThemeConfiguration) => void;
}

/**
 * Default theme context value.
 * Used as fallback when ThemeProvider is not in the component tree.
 */
const defaultTheme = createTheme(defaultThemeConfiguration);

const defaultContextValue: ThemeContextValue = {
  theme: defaultTheme,
  config: defaultThemeConfiguration,
  setConfig: () => {
    console.warn('setConfig called outside of ThemeProvider');
  },
};

/**
 * ThemeContext provides theme configuration throughout the app.
 * Must be used within a ThemeProvider component.
 */
export const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);
