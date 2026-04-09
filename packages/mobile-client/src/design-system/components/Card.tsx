/**
 * Card Component
 *
 * A versatile card component with surface hierarchy variants for tonal layering.
 * Supports custom padding, border radius, elevation, and optional press interaction.
 *
 * Requirements: 10.2
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useDesignSystem } from '../theme/useDesignSystem';
import type { SpacingTokens } from '../tokens/spacing';
import type { BorderRadiusTokens } from '../tokens/borderRadius';

/**
 * Card variant types mapping to surface hierarchy
 * - lowest: surfaceContainerLowest (code blocks, deepest depth)
 * - low: surfaceContainerLow (cards on surface)
 * - default: surfaceContainer (standard containers)
 * - high: surfaceContainerHigh (elevated elements)
 * - highest: surfaceContainerHighest (inputs, inactive states)
 */
export type CardVariant = 'lowest' | 'low' | 'default' | 'high' | 'highest';

export interface CardProps {
  /**
   * Card variant mapping to surface hierarchy
   * @default 'default'
   */
  variant?: CardVariant;

  /**
   * Padding size using spacing tokens
   * @default 'lg'
   */
  padding?: keyof SpacingTokens;

  /**
   * Border radius size using border radius tokens
   * @default 'lg'
   */
  borderRadius?: keyof BorderRadiusTokens;

  /**
   * Elevation level (shadow depth)
   * Note: Tonal layering is preferred over elevation in Obsidian design
   * @default 0
   */
  elevation?: number;

  /**
   * Card content
   */
  children: React.ReactNode;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Optional press handler for interactive cards
   * When provided, card becomes touchable with press feedback
   */
  onPress?: () => void;
}

/**
 * Card component with surface hierarchy variants
 * Memoized for performance optimization (Requirement 15.6)
 */
export const Card = React.memo<CardProps>(
  ({
    variant = 'default',
    padding = 'lg',
    borderRadius = 'lg',
    elevation = 0,
    children,
    style,
    onPress,
  }) => {
    const { theme } = useDesignSystem();

    /**
     * Get background color based on variant (surface hierarchy)
     */
    const getBackgroundColor = (): string => {
      switch (variant) {
        case 'lowest':
          return theme.colors.surfaceContainerLowest;
        case 'low':
          return theme.colors.surfaceContainerLow;
        case 'default':
          return theme.colors.surfaceContainer;
        case 'high':
          return theme.colors.surfaceContainerHigh;
        case 'highest':
          return theme.colors.surfaceContainerHighest;
      }
    };

    /**
     * Get padding value from spacing tokens
     */
    const getPadding = (): number => {
      return theme.spacing[padding];
    };

    /**
     * Get border radius value from border radius tokens
     */
    const getBorderRadius = (): number => {
      return theme.borderRadius[borderRadius];
    };

    /**
     * Build card style
     */
    const cardStyle: StyleProp<ViewStyle> = [
      styles.card,
      {
        backgroundColor: getBackgroundColor(),
        padding: getPadding(),
        borderRadius: getBorderRadius(),
        elevation,
      },
      style,
    ];

    /**
     * Render card as touchable if onPress is provided
     */
    if (onPress) {
      return (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={cardStyle}>
          {children}
        </TouchableOpacity>
      );
    }

    /**
     * Render card as static view
     */
    return <View style={cardStyle}>{children}</View>;
  },
  // Custom comparison function for better memoization
  (prevProps, nextProps) => {
    return (
      prevProps.variant === nextProps.variant &&
      prevProps.padding === nextProps.padding &&
      prevProps.borderRadius === nextProps.borderRadius &&
      prevProps.elevation === nextProps.elevation &&
      prevProps.onPress === nextProps.onPress &&
      prevProps.style === nextProps.style &&
      prevProps.children === nextProps.children
    );
  }
);

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
