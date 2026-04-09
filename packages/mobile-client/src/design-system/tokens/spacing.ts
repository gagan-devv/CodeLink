/**
 * Spacing Tokens
 *
 * Defines all spacing tokens for the Obsidian UI design system.
 * Spacing scale follows a consistent progression from xs (4px) to 4xl (64px)
 * for margins, padding, and gaps throughout the interface.
 *
 * Requirements: 1.4
 */

/**
 * SpacingTokens interface defines all spacing values used in the design system.
 * Values are in pixels and follow a consistent scale for predictable layouts.
 */
export interface SpacingTokens {
  xs: number; // 0.25rem / 4px - minimal spacing
  sm: number; // 0.5rem / 8px - small spacing
  md: number; // 0.75rem / 12px - medium spacing
  lg: number; // 1rem / 16px - large spacing (base unit)
  xl: number; // 1.5rem / 24px - extra large spacing
  '2xl': number; // 2rem / 32px - 2x extra large spacing
  '3xl': number; // 3rem / 48px - 3x extra large spacing
  '4xl': number; // 4rem / 64px - 4x extra large spacing
}

/**
 * Default spacing scale matching the design specifications.
 * All values are in pixels for React Native compatibility.
 */
export const defaultSpacingTokens: SpacingTokens = {
  xs: 4, // 0.25rem
  sm: 8, // 0.5rem
  md: 12, // 0.75rem
  lg: 16, // 1rem (base unit)
  xl: 24, // 1.5rem
  '2xl': 32, // 2rem
  '3xl': 48, // 3rem
  '4xl': 64, // 4rem
};

/**
 * Export the default spacing tokens as the main export.
 * This can be overridden by theme configuration in the future.
 */
export const spacingTokens = defaultSpacingTokens;
