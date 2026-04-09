/**
 * Typography Tokens
 *
 * Defines all typography tokens for the Obsidian UI design system including:
 * - Font families (Manrope, Inter, Space Grotesk, monospace)
 * - Typography size scale (displayLg through labelSm)
 * - Font weights (regular through extrabold)
 * - Line heights (tight, normal, relaxed)
 *
 * Requirements: 1.3
 */

/**
 * TypographyTokens interface defines all typography values used in the design system.
 * Typography follows the Obsidian IDE aesthetic with editorial font choices:
 * - Manrope for headlines (sophisticated, geometric sans-serif)
 * - Inter for body text (highly legible, optimized for screens)
 * - Space Grotesk for labels (technical, monospace-inspired)
 * - Monospace for code (Fira Code or system fallback)
 */
export interface TypographyTokens {
  fonts: {
    headline: string; // Manrope - for headlines and display text
    body: string; // Inter - for body text and paragraphs
    label: string; // Space Grotesk - for labels and metadata
    mono: string; // Fira Code or system monospace - for code
  };
  sizes: {
    displayLg: number; // 3.5rem / 56px - largest display text
    displayMd: number; // 2.8rem / 44.8px - medium display text
    displaySm: number; // 2.25rem / 36px - small display text
    headlineLg: number; // 2rem / 32px - large headlines
    headlineMd: number; // 1.75rem / 28px - medium headlines
    headlineSm: number; // 1.5rem / 24px - small headlines
    titleLg: number; // 1.375rem / 22px - large titles
    titleMd: number; // 1.125rem / 18px - medium titles
    titleSm: number; // 0.875rem / 14px - small titles
    bodyLg: number; // 1rem / 16px - large body text
    bodyMd: number; // 0.875rem / 14px - medium body text
    bodySm: number; // 0.75rem / 12px - small body text
    labelLg: number; // 0.875rem / 14px - large labels
    labelMd: number; // 0.75rem / 12px - medium labels
    labelSm: number; // 0.6875rem / 11px - small labels
  };
  weights: {
    regular: number; // 400 - normal text weight
    medium: number; // 500 - slightly emphasized
    semibold: number; // 600 - emphasized text
    bold: number; // 700 - strong emphasis
    extrabold: number; // 800 - maximum emphasis
  };
  lineHeights: {
    tight: number; // 1.2 - compact line spacing
    normal: number; // 1.5 - standard line spacing
    relaxed: number; // 1.75 - loose line spacing
  };
}

/**
 * Default typography configuration matching the Obsidian IDE aesthetic.
 * Font families will be loaded via Expo Font with appropriate fallbacks.
 */
export const defaultTypographyTokens: TypographyTokens = {
  fonts: {
    headline: 'Manrope', // Geometric sans-serif for headlines
    body: 'Inter', // Optimized for body text readability
    label: 'SpaceGrotesk', // Technical aesthetic for labels
    mono: 'FiraCode', // Monospace for code (fallback to system)
  },
  sizes: {
    displayLg: 56, // 3.5rem
    displayMd: 44.8, // 2.8rem
    displaySm: 36, // 2.25rem
    headlineLg: 32, // 2rem
    headlineMd: 28, // 1.75rem
    headlineSm: 24, // 1.5rem
    titleLg: 22, // 1.375rem
    titleMd: 18, // 1.125rem
    titleSm: 14, // 0.875rem
    bodyLg: 16, // 1rem
    bodyMd: 14, // 0.875rem
    bodySm: 12, // 0.75rem
    labelLg: 14, // 0.875rem
    labelMd: 12, // 0.75rem
    labelSm: 11, // 0.6875rem
  },
  weights: {
    regular: 400, // Normal weight
    medium: 500, // Medium weight
    semibold: 600, // Semibold weight
    bold: 700, // Bold weight
    extrabold: 800, // Extrabold weight
  },
  lineHeights: {
    tight: 1.2, // Compact spacing for headlines
    normal: 1.5, // Standard spacing for body text
    relaxed: 1.75, // Loose spacing for readability
  },
};

/**
 * Export the default typography tokens as the main export.
 * This can be overridden by theme configuration in the future.
 */
export const typographyTokens = defaultTypographyTokens;
