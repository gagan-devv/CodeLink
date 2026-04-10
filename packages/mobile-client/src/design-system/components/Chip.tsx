/**
 * Chip Component
 *
 * A compact, interactive chip component for tags, filters, and selections.
 * Supports icons, selected states, variants, and haptic feedback.
 *
 * Requirements: 10.3, 5.11
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../theme/useDesignSystem';

/**
 * Chip variant types
 * - default: Standard chip with surface colors
 * - success: Success state with secondary (green) color
 * - error: Error state with error (red) color
 * - warning: Warning state with tertiary (orange) color
 */
export type ChipVariant = 'default' | 'success' | 'error' | 'warning';

/**
 * Chip size variants
 * - sm: Small chip (44px height) - meets WCAG 2.1 AA minimum
 * - md: Medium chip (44px height) - default, meets WCAG 2.1 AA minimum
 */
export type ChipSize = 'sm' | 'md';

export interface ChipProps {
  /**
   * Chip label text
   */
  label: string;

  /**
   * Optional icon component to display (Material Symbols or custom)
   */
  icon?: React.ReactNode;

  /**
   * Selected state - highlights chip with secondary color
   * @default false
   */
  selected?: boolean;

  /**
   * Chip variant for different semantic states
   * @default 'default'
   */
  variant?: ChipVariant;

  /**
   * Chip size
   * @default 'md'
   */
  size?: ChipSize;

  /**
   * Optional press handler for interactive chips
   */
  onPress?: () => void;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Accessibility label for screen readers
   * If not provided, uses label text as accessibility label
   */
  accessibilityLabel?: string;

  /**
   * Accessibility hint for screen readers
   * Provides additional context about what happens when chip is pressed
   */
  accessibilityHint?: string;
}

/**
 * Chip component for tags, filters, and selections
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  selected = false,
  variant = 'default',
  size = 'md',
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { theme } = useDesignSystem();

  /**
   * Handle press - trigger haptic feedback and callback
   */
  const handlePress = () => {
    if (!onPress) return;

    // Trigger haptic feedback on press
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress();
  };

  /**
   * Get chip height based on size
   * All sizes meet WCAG 2.1 AA minimum 44x44pt touch target (Requirement 14.8)
   */
  const getHeight = (): number => {
    switch (size) {
      case 'sm':
        return 44; // Increased from 24 to meet 44pt minimum touch target
      case 'md':
        return 44; // Increased from 32 to meet 44pt minimum touch target
    }
  };

  /**
   * Get horizontal padding based on size
   * Adjusted for 44pt minimum touch target height
   */
  const getPaddingHorizontal = (): number => {
    switch (size) {
      case 'sm':
        return theme.spacing.md; // 12px
      case 'md':
        return theme.spacing.lg; // 16px
    }
  };

  /**
   * Get font size based on size
   */
  const getFontSize = (): number => {
    switch (size) {
      case 'sm':
        return theme.typography.sizes.labelSm;
      case 'md':
        return theme.typography.sizes.labelMd;
    }
  };

  /**
   * Get icon size based on chip size
   * Adjusted for 44pt minimum touch target height
   */
  const getIconSize = (): number => {
    switch (size) {
      case 'sm':
        return 18; // Increased from 14 for better proportion
      case 'md':
        return 20; // Increased from 16 for better proportion
    }
  };

  /**
   * Get background color based on variant and selected state
   */
  const getBackgroundColor = (): string => {
    // Selected state always uses secondary color
    if (selected) {
      return theme.colors.secondary;
    }

    // Variant colors for unselected state
    switch (variant) {
      case 'default':
        return theme.colors.surfaceContainerHigh;
      case 'success':
        return `${theme.colors.secondary}26`; // 15% opacity
      case 'error':
        return `${theme.colors.error}26`; // 15% opacity
      case 'warning':
        return `${theme.colors.tertiary}26`; // 15% opacity
    }
  };

  /**
   * Get text color based on variant and selected state
   */
  const getTextColor = (): string => {
    // Selected state uses onSecondary color
    if (selected) {
      return theme.colors.onSecondary;
    }

    // Variant colors for unselected state
    switch (variant) {
      case 'default':
        return theme.colors.onSurface;
      case 'success':
        return theme.colors.secondary;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.tertiary;
    }
  };

  /**
   * Get border color based on variant and selected state
   */
  const getBorderColor = (): string | undefined => {
    // Selected state has no border
    if (selected) {
      return undefined;
    }

    // Variant border colors for unselected state
    switch (variant) {
      case 'default':
        return theme.colors.outline;
      case 'success':
        return theme.colors.secondary;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.tertiary;
    }
  };

  const minHeight = getHeight();
  const paddingHorizontal = getPaddingHorizontal();
  const fontSize = getFontSize();
  const iconSize = getIconSize();
  const backgroundColor = getBackgroundColor();
  const textColor = getTextColor();
  const borderColor = getBorderColor();

  const chipStyle: StyleProp<ViewStyle> = [
    styles.chip,
    {
      minHeight, // Use minHeight instead of height to allow growth with larger text (Requirement 14.9)
      paddingHorizontal,
      paddingVertical: theme.spacing.xs, // Add vertical padding for text scaling
      backgroundColor,
      borderRadius: theme.borderRadius.full, // rounded-full
      borderWidth: borderColor ? 1 : 0,
      borderColor,
    },
    style,
  ];

  /**
   * Render chip content (icon + label)
   */
  const renderContent = () => (
    <View style={styles.contentContainer}>
      {/* Icon */}
      {icon && (
        <View style={[styles.iconContainer, { width: iconSize, height: iconSize }]}>{icon}</View>
      )}

      {/* Label */}
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontSize,
            fontFamily: theme.typography.fonts.label,
            fontWeight: String(theme.typography.weights.medium) as
              | '400'
              | '500'
              | '600'
              | '700'
              | '800',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  /**
   * Render chip as touchable if onPress is provided
   */
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        style={chipStyle}
        accessible={true}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{
          selected,
        }}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  /**
   * Render chip as static view
   */
  return (
    <View
      style={chipStyle}
      accessible={true}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="text"
    >
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start', // Don't stretch to full width
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
