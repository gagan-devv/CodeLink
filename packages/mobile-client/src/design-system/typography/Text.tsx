/**
 * Text Component
 *
 * Typography component with design system variants and styling.
 * Supports all typography scales from display-lg to label-sm with
 * automatic font family mapping based on variant type.
 *
 * Requirements: 2.7, 2.8, 2.9
 */

import React from 'react';
import { Text as RNText, type TextStyle, type StyleProp } from 'react-native';
import { useDesignSystem } from '../theme/useDesignSystem';
import type { ColorTokens } from '../tokens/colors';
import type { TypographyTokens } from '../tokens/typography';

/**
 * Typography variant types
 */
export type TypographyVariant =
  | 'display-lg'
  | 'display-md'
  | 'display-sm'
  | 'headline-lg'
  | 'headline-md'
  | 'headline-sm'
  | 'title-lg'
  | 'title-md'
  | 'title-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'label-lg'
  | 'label-md'
  | 'label-sm';

/**
 * Text component props
 */
export interface TextProps {
  /**
   * Typography variant determining size and font family
   */
  variant: TypographyVariant;

  /**
   * Text color from design system color tokens
   */
  color?: keyof ColorTokens;

  /**
   * Font weight from design system typography tokens
   */
  weight?: keyof TypographyTokens['weights'];

  /**
   * Text alignment
   */
  align?: 'left' | 'center' | 'right';

  /**
   * Transform text to uppercase
   */
  uppercase?: boolean;

  /**
   * Text content
   */
  children: React.ReactNode;

  /**
   * Additional custom styles
   */
  style?: StyleProp<TextStyle>;
}

/**
 * Maps variant type to font family category
 */
function getFontFamilyForVariant(variant: TypographyVariant): keyof TypographyTokens['fonts'] {
  // Display and headline variants use Manrope
  if (variant.startsWith('display-') || variant.startsWith('headline-')) {
    return 'headline';
  }

  // Body and title variants use Inter
  if (variant.startsWith('body-') || variant.startsWith('title-')) {
    return 'body';
  }

  // Label variants use Space Grotesk
  if (variant.startsWith('label-')) {
    return 'label';
  }

  // Default to body font
  return 'body';
}

/**
 * Maps variant to font size token key
 */
function getFontSizeKey(variant: TypographyVariant): keyof TypographyTokens['sizes'] {
  // Convert variant format (e.g., 'display-lg') to camelCase (e.g., 'displayLg')
  const parts = variant.split('-');
  const camelCase = parts[0] + parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  return camelCase as keyof TypographyTokens['sizes'];
}

/**
 * Text component with design system typography variants.
 *
 * Automatically applies the correct font family based on variant:
 * - display-* and headline-* variants use Manrope
 * - body-* and title-* variants use Inter
 * - label-* variants use Space Grotesk
 *
 * @example
 * ```tsx
 * <Text variant="headline-lg" weight="bold" color="primary">
 *   Welcome to CodeLink
 * </Text>
 *
 * <Text variant="body-md" color="onSurface">
 *   This is body text with default styling
 * </Text>
 *
 * <Text variant="label-sm" uppercase color="onSurfaceVariant">
 *   Metadata Label
 * </Text>
 * ```
 */
export const Text: React.FC<TextProps> = ({
  variant,
  color = 'onSurface',
  weight = 'regular',
  align = 'left',
  uppercase = false,
  children,
  style,
}) => {
  const { theme } = useDesignSystem();

  // Get font family based on variant type
  const fontFamilyCategory = getFontFamilyForVariant(variant);
  const fontFamily = theme.typography.fonts[fontFamilyCategory];

  // Get font size from variant
  const fontSizeKey = getFontSizeKey(variant);
  const fontSize = theme.typography.sizes[fontSizeKey];

  // Get font weight
  const fontWeight = theme.typography.weights[weight];

  // Get text color
  const textColor = theme.colors[color];

  // Compose text style
  const textStyle: TextStyle = {
    fontFamily,
    fontSize,
    fontWeight: String(fontWeight) as TextStyle['fontWeight'],
    color: textColor,
    textAlign: align,
    textTransform: uppercase ? 'uppercase' : 'none',
  };

  return <RNText style={[textStyle, style]}>{children}</RNText>;
};
