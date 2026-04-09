/**
 * Navigation Container with Theme Integration
 *
 * Configures React Navigation with design system theme integration
 * and custom screen transition animations.
 *
 * Requirements: 12.1, 12.2
 */

import React, { type ReactNode } from 'react';
import { NavigationContainer as RNNavigationContainer, type Theme } from '@react-navigation/native';
import { useDesignSystem } from '../design-system';

/**
 * Props for NavigationContainer
 */
interface NavigationContainerProps {
  children: ReactNode;
}

/**
 * Creates a React Navigation theme from the design system theme.
 * Maps design system color tokens to React Navigation theme structure.
 */
function createNavigationTheme(
  designSystemTheme: ReturnType<typeof useDesignSystem>['theme']
): Theme {
  return {
    dark: true, // Always use dark theme as per requirements
    colors: {
      primary: designSystemTheme.colors.primary,
      background: designSystemTheme.colors.surface,
      card: designSystemTheme.colors.surfaceContainer,
      text: designSystemTheme.colors.onSurface,
      border: designSystemTheme.colors.outlineVariant,
      notification: designSystemTheme.colors.secondary,
    },
    fonts: {
      regular: {
        fontFamily: designSystemTheme.typography.fonts.body,
        fontWeight: '400',
      },
      medium: {
        fontFamily: designSystemTheme.typography.fonts.body,
        fontWeight: '500',
      },
      bold: {
        fontFamily: designSystemTheme.typography.fonts.body,
        fontWeight: '700',
      },
      heavy: {
        fontFamily: designSystemTheme.typography.fonts.body,
        fontWeight: '800',
      },
    },
  };
}

/**
 * NavigationContainer component wraps React Navigation's NavigationContainer
 * with design system theme integration.
 *
 * Automatically syncs navigation theme with design system theme changes.
 */
export const NavigationContainer: React.FC<NavigationContainerProps> = ({ children }) => {
  const { theme } = useDesignSystem();

  // Create navigation theme from design system theme
  const navigationTheme = createNavigationTheme(theme);

  return <RNNavigationContainer theme={navigationTheme}>{children}</RNNavigationContainer>;
};
