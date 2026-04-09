/**
 * Color Tokens
 *
 * Defines all color tokens for the Obsidian UI design system including:
 * - Surface hierarchy colors for tonal layering
 * - Primary, secondary, tertiary, and error accent colors
 * - Semantic color tokens for text and outlines
 *
 */

/**
 * ColorTokens interface defines all color values used in the design system.
 * Colors follow Material Design 3 naming conventions with surface hierarchy
 * for tonal layering instead of drop shadows or borders.
 */
export interface ColorTokens {
  // Surface hierarchy - used for tonal layering to create depth
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceVariant: string;
  surfaceBright: string;
  surfaceDim: string;

  // Primary colors - main brand color (#95ccff - light blue)
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;

  // Secondary colors - accent color (#61dac1 - teal/green)
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;

  // Tertiary colors - accent color (#fab79d - peach/orange)
  tertiary: string;
  tertiaryContainer: string;
  onTertiary: string;
  onTertiaryContainer: string;

  // Error colors - error states (#ffb4ab - light red)
  error: string;
  errorContainer: string;
  onError: string;
  onErrorContainer: string;

  // Text colors - for content on various surfaces
  onSurface: string;
  onSurfaceVariant: string;
  onBackground: string;

  // Outline colors - for borders and dividers
  outline: string;
  outlineVariant: string;
}

/**
 * Default dark theme color palette matching the Obsidian IDE aesthetic.
 * All colors are defined to match the Tailwind configuration in Stitch designs.
 */
export const defaultColorPalette: ColorTokens = {
  // Surface hierarchy - dark theme with subtle variations for depth
  surface: '#131313', // Base surface (darkest)
  surfaceContainerLowest: '#0f0f0f', // Lowest container (code blocks)
  surfaceContainerLow: '#1a1a1a', // Low container (cards)
  surfaceContainer: '#1f1f1f', // Default container
  surfaceContainerHigh: '#2a2a2a', // High container (elevated elements)
  surfaceContainerHighest: '#353535', // Highest container (inputs, inactive states)
  surfaceVariant: '#2a2a2a', // Variant surface
  surfaceBright: '#3a3a3a', // Bright surface (focused states)
  surfaceDim: '#0a0a0a', // Dim surface

  // Primary colors - light blue (#95ccff)
  primary: '#95ccff', // Primary brand color
  primaryContainer: '#569cd6', // Primary container (darker blue for keywords)
  onPrimary: '#000000', // Text on primary
  onPrimaryContainer: '#ffffff', // Text on primary container

  // Secondary colors - teal/green (#61dac1)
  secondary: '#61dac1', // Secondary accent (success, active states)
  secondaryContainer: '#4db8a3', // Secondary container
  onSecondary: '#000000', // Text on secondary
  onSecondaryContainer: '#ffffff', // Text on secondary container

  // Tertiary colors - peach/orange (#fab79d)
  tertiary: '#fab79d', // Tertiary accent (warnings, highlights)
  tertiaryContainer: '#e89b7f', // Tertiary container
  onTertiary: '#000000', // Text on tertiary
  onTertiaryContainer: '#ffffff', // Text on tertiary container

  // Error colors - light red (#ffb4ab)
  error: '#ffb4ab', // Error state
  errorContainer: '#ff8a80', // Error container
  onError: '#000000', // Text on error
  onErrorContainer: '#ffffff', // Text on error container

  // Text colors - optimized for dark theme readability
  onSurface: '#ffffff', // Primary text on surface
  onSurfaceVariant: '#b0b0b0', // Secondary text, dimmed
  onBackground: '#ffffff', // Text on background

  // Outline colors - for borders and dividers
  outline: '#5a5a5a', // Standard outline
  outlineVariant: '#3a3a3a', // Subtle outline variant
};

/**
 * Export the default palette as the main color tokens export.
 * This can be overridden by theme configuration in the future.
 */
export const colorTokens = defaultColorPalette;
