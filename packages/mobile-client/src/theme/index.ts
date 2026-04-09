/**
 * Theme configuration for the mobile client
 * Supports light and dark modes with Material Design 3
 */

import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6200ee',
    secondary: '#03dac6',
    error: '#b00020',
    background: '#ffffff',
    surface: '#f5f5f5',
    surfaceVariant: '#e7e0ec',
    onSurface: '#1c1b1f',
    onSurfaceVariant: '#49454f',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#BB86FC',
    secondary: '#03DAC6',
    error: '#CF6679',
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2d2d2d',
    onSurface: '#e1e1e1',
    onSurfaceVariant: '#c7c7c7',
  },
};

export type ThemeMode = 'light' | 'dark' | 'auto';
