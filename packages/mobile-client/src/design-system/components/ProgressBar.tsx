/**
 * ProgressBar Component
 *
 * A horizontal progress bar component for visualizing metrics and progress.
 * Supports color variants, percentage display, and optional labels.
 *
 * Requirements: 10.9, 3.4
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useDesignSystem } from '../theme/useDesignSystem';

/**
 * Progress bar color variants
 */
export type ProgressBarVariant = 'primary' | 'secondary' | 'tertiary' | 'error';

export interface ProgressBarProps {
  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Color variant
   * @default 'primary'
   */
  variant?: ProgressBarVariant;

  /**
   * Show percentage label
   * @default false
   */
  showLabel?: boolean;

  /**
   * Custom label text (overrides percentage)
   */
  label?: string;

  /**
   * Progress bar height
   * @default 8
   */
  height?: number;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * ProgressBar component for visualizing metrics
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  variant = 'primary',
  showLabel = false,
  label,
  height = 8,
  style,
}) => {
  const { theme } = useDesignSystem();

  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  /**
   * Get progress bar color based on variant
   */
  const getProgressColor = (): string => {
    switch (variant) {
      case 'primary':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.secondary;
      case 'tertiary':
        return theme.colors.tertiary;
      case 'error':
        return theme.colors.error;
    }
  };

  /**
   * Get background color (dimmed version of progress color)
   */
  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'primary':
        return theme.colors.primaryContainer;
      case 'secondary':
        return theme.colors.secondaryContainer;
      case 'tertiary':
        return theme.colors.tertiaryContainer;
      case 'error':
        return theme.colors.errorContainer;
    }
  };

  const progressColor = getProgressColor();
  const backgroundColor = getBackgroundColor();

  /**
   * Get label text to display
   */
  const getLabelText = (): string => {
    if (label) {
      return label;
    }
    if (showLabel) {
      return `${Math.round(clampedProgress)}%`;
    }
    return '';
  };

  const labelText = getLabelText();

  return (
    <View style={[styles.container, style]}>
      {/* Progress bar */}
      <View
        style={[
          styles.track,
          {
            height,
            backgroundColor,
            borderRadius: height / 2,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: progressColor,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>

      {/* Optional label */}
      {labelText && (
        <Text
          style={[
            styles.label,
            {
              color: theme.colors.onSurfaceVariant,
              fontFamily: theme.typography.fonts.label,
              fontSize: theme.typography.sizes.labelSm,
              fontWeight: String(theme.typography.weights.medium) as
                | '400'
                | '500'
                | '600'
                | '700'
                | '800',
            },
          ]}
        >
          {labelText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  label: {
    marginTop: 4,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
