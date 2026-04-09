/**
 * Theme Configuration Types
 *
 * Defines TypeScript interfaces for theme configuration including:
 * - ThemeConfig interface with all design tokens
 * - ThemeConfiguration interface for user preferences
 * - Default theme configuration
 *
 * Requirements: 1.6, 1.7
 */

import type { ColorTokens } from '../tokens/colors';
import type { TypographyTokens } from '../tokens/typography';
import type { SpacingTokens } from '../tokens/spacing';
import type { BorderRadiusTokens } from '../tokens/borderRadius';

/**
 * ThemeConfig interface defines the complete theme configuration
 * including all design tokens (colors, typography, spacing, border radius).
 */
export interface ThemeConfig {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
}

/**
 * ThemeConfiguration interface defines user-configurable theme preferences.
 * These preferences control the theme mode and accessibility features.
 */
export interface ThemeConfiguration {
  /**
   * Theme mode: 'dark', 'light', or 'auto' (follows system preference)
   * Currently only dark mode is fully implemented.
   */
  mode: 'dark' | 'light' | 'auto';

  /**
   * High contrast mode for improved accessibility.
   * When enabled, increases contrast ratios to 7:1 minimum.
   */
  highContrast: boolean;

  /**
   * Optional custom color overrides.
   * Allows partial customization of the color palette.
   */
  customColors?: Partial<ColorTokens>;
}

/**
 * Default theme configuration.
 * Uses dark mode as the primary theme with standard contrast.
 */
export const defaultThemeConfiguration: ThemeConfiguration = {
  mode: 'dark',
  highContrast: false,
  customColors: undefined,
};
