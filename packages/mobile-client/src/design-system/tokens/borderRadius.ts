/**
 * Border Radius Tokens
 *
 * Defines all border radius tokens for the Obsidian UI design system.
 * Border radius values range from sm (2px) for subtle rounding to full (9999px)
 * for pill-shaped elements like chips and status indicators.
 *
 * Requirements: 1.5
 */

/**
 * BorderRadiusTokens interface defines all border radius values used in the design system.
 * Values are in pixels and provide consistent corner rounding across components.
 */
export interface BorderRadiusTokens {
  sm: number; // 0.125rem / 2px - subtle rounding
  md: number; // 0.375rem / 6px - medium rounding
  lg: number; // 0.5rem / 8px - large rounding (default for cards)
  xl: number; // 0.75rem / 12px - extra large rounding
  '2xl': number; // 1rem / 16px - 2x extra large rounding
  full: number; // 9999px - fully rounded (pills, circles)
}

/**
 * Default border radius scale matching the design specifications.
 * All values are in pixels for React Native compatibility.
 */
export const defaultBorderRadiusTokens: BorderRadiusTokens = {
  sm: 2, // 0.125rem - subtle rounding
  md: 6, // 0.375rem - medium rounding
  lg: 8, // 0.5rem - large rounding (default for cards)
  xl: 12, // 0.75rem - extra large rounding
  '2xl': 16, // 1rem - 2x extra large rounding
  full: 9999, // fully rounded (pills, circles)
};

/**
 * Export the default border radius tokens as the main export.
 * This can be overridden by theme configuration in the future.
 */
export const borderRadiusTokens = defaultBorderRadiusTokens;
