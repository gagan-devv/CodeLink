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
 * - sm: Small chip (24px height)
 * - md: Medium chip (32px height) - default
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
   */
  const getHeight = (): number => {
    switch (size) {
      case 'sm':
        return 24;
      case 'md':
        return 32;
    }
  };

  /**
   * Get horizontal padding based on size
   */
  const getPaddingHorizontal = (): number => {
    switch (size) {
      case 'sm':
        return theme.spacing.sm;
      case 'md':
        return theme.spacing.md;
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
   */
  const getIconSize = (): number => {
    switch (size) {
      case 'sm':
        return 14;
      case 'md':
        return 16;
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

  const height = getHeight();
  const paddingHorizontal = getPaddingHorizontal();
  const fontSize = getFontSize();
  const iconSize = getIconSize();
  const backgroundColor = getBackgroundColor();
  const textColor = getTextColor();
  const borderColor = getBorderColor();

  const chipStyle: StyleProp<ViewStyle> = [
    styles.chip,
    {
      height,
      paddingHorizontal,
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
      <TouchableOpacity activeOpacity={0.7} onPress={handlePress} style={chipStyle}>
        {renderContent()}
      </TouchableOpacity>
    );
  }

  /**
   * Render chip as static view
   */
  return <View style={chipStyle}>{renderContent()}</View>;
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
