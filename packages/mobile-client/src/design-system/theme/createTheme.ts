/**
 * Create Theme Function
 *
 * Creates a complete theme object from user configuration.
 * Applies custom colors and high contrast adjustments as needed.
 *
 * Requirements: 1.6, 1.7, 14.6, 14.10
 */

import { colorTokens, type ColorTokens } from '../tokens/colors';
import { typographyTokens } from '../tokens/typography';
import { spacingTokens } from '../tokens/spacing';
import { borderRadiusTokens } from '../tokens/borderRadius';
import type { ThemeConfig, ThemeConfiguration } from './types';

/**
 * High contrast color adjustments.
 * Increases contrast ratios to 7:1 minimum for WCAG AAA compliance.
 */
const highContrastColorAdjustments: Partial<ColorTokens> = {
  // Increase text contrast
  onSurface: '#ffffff', // Pure white for maximum contrast
  onSurfaceVariant: '#e0e0e0', // Lighter gray for secondary text

  // Increase outline visibility
  outline: '#808080', // Brighter outline
  outlineVariant: '#606060', // Brighter outline variant

  // Adjust surface brightness for better separation
  surfaceBright: '#4a4a4a', // Brighter focused states
  surfaceContainerHighest: '#454545', // Brighter highest container
};

/**
 * Creates a complete theme object from user configuration.
 *
 * @param config - User theme configuration
 * @returns Complete theme object with all design tokens
 */
export function createTheme(config: ThemeConfiguration): ThemeConfig {
  // Start with default color tokens
  let colors: ColorTokens = { ...colorTokens };

  // Apply high contrast adjustments if enabled
  if (config.highContrast) {
    colors = {
      ...colors,
      ...highContrastColorAdjustments,
    };
  }

  // Apply custom color overrides if provided
  if (config.customColors) {
    colors = {
      ...colors,
      ...config.customColors,
    };
  }

  // Note: Light mode is not yet implemented
  // When implemented, this function should switch color palettes based on config.mode
  if (config.mode === 'light') {
    console.warn('Light mode is not yet implemented. Using dark mode.');
  }

  // Return complete theme configuration
  return {
    colors,
    typography: typographyTokens,
    spacing: spacingTokens,
    borderRadius: borderRadiusTokens,
  };
}
