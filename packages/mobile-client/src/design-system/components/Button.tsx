/**
 * Button Component
 *
 * A versatile button component with multiple variants, sizes, and states.
 * Supports icons, loading states, haptic feedback, and press animations.
 *
 * Requirements: 10.1, 12.3, 12.9
 */

import React, { useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignSystem } from '../theme/useDesignSystem';

/**
 * Button variant types
 * - primary: Gradient background (primary to primaryContainer)
 * - secondary: Secondary color background
 * - tertiary: Transparent with secondary text
 * - ghost: Transparent with outline
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost';

/**
 * Button size variants
 * - sm: Small button (32px height)
 * - md: Medium button (44px height) - default
 * - lg: Large button (56px height)
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Icon position within button
 */
export type IconPosition = 'left' | 'right';

/**
 * Haptic feedback intensity
 */
export type HapticFeedback = 'light' | 'medium' | 'heavy';

export interface ButtonProps {
  /**
   * Button variant style
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * Button size
   * @default 'md'
   */
  size?: ButtonSize;

  /**
   * Icon component to display (Material Symbols or custom)
   */
  icon?: React.ReactNode;

  /**
   * Position of icon relative to text
   * @default 'left'
   */
  iconPosition?: IconPosition;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Loading state - shows spinner and disables interaction
   * @default false
   */
  loading?: boolean;

  /**
   * Make button full width of container
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Press handler
   */
  onPress: () => void;

  /**
   * Button label text
   */
  children: React.ReactNode;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Haptic feedback intensity on press
   * @default 'light'
   */
  hapticFeedback?: HapticFeedback;
}

/**
 * Button component with variants, sizes, and animations
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  onPress,
  children,
  style,
  hapticFeedback = 'light',
}) => {
  const { theme } = useDesignSystem();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Determine if button is interactive
  const isInteractive = !disabled && !loading;

  /**
   * Handle press in - start scale animation
   */
  const handlePressIn = () => {
    if (!isInteractive) return;

    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  /**
   * Handle press out - reset scale animation
   */
  const handlePressOut = () => {
    if (!isInteractive) return;

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  /**
   * Handle press - trigger haptic feedback and callback
   */
  const handlePress = () => {
    if (!isInteractive) return;

    // Trigger haptic feedback
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      switch (hapticFeedback) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    }

    onPress();
  };

  /**
   * Get button height based on size
   */
  const getHeight = (): number => {
    switch (size) {
      case 'sm':
        return 32;
      case 'md':
        return 44;
      case 'lg':
        return 56;
    }
  };

  /**
   * Get horizontal padding based on size
   */
  const getPaddingHorizontal = (): number => {
    switch (size) {
      case 'sm':
        return theme.spacing.md;
      case 'md':
        return theme.spacing.lg;
      case 'lg':
        return theme.spacing.xl;
    }
  };

  /**
   * Get font size based on size
   */
  const getFontSize = (): number => {
    switch (size) {
      case 'sm':
        return theme.typography.sizes.labelMd;
      case 'md':
        return theme.typography.sizes.labelLg;
      case 'lg':
        return theme.typography.sizes.titleSm;
    }
  };

  /**
   * Get text color based on variant and state
   */
  const getTextColor = (): string => {
    if (disabled) {
      return theme.colors.onSurfaceVariant;
    }

    switch (variant) {
      case 'primary':
        return theme.colors.onPrimary;
      case 'secondary':
        return theme.colors.onSecondary;
      case 'tertiary':
      case 'ghost':
        return theme.colors.secondary;
    }
  };

  /**
   * Render button content (icon + text + loading spinner)
   */
  const renderContent = () => {
    const textColor = getTextColor();
    const fontSize = getFontSize();

    return (
      <View style={styles.contentContainer}>
        {/* Left icon */}
        {icon && iconPosition === 'left' && !loading && <View style={styles.iconLeft}>{icon}</View>}

        {/* Loading spinner */}
        {loading && <ActivityIndicator size="small" color={textColor} style={styles.spinner} />}

        {/* Button text */}
        <Text
          style={[
            styles.text,
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
        >
          {children}
        </Text>

        {/* Right icon */}
        {icon && iconPosition === 'right' && !loading && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </View>
    );
  };

  /**
   * Render button based on variant
   */
  const renderButton = () => {
    const height = getHeight();
    const paddingHorizontal = getPaddingHorizontal();

    const baseStyle = [
      styles.button,
      {
        height,
        paddingHorizontal,
        borderRadius: theme.borderRadius.lg,
        opacity: disabled ? 0.5 : 1,
      },
      fullWidth && styles.fullWidth,
      style,
    ];

    // Primary variant with gradient
    if (variant === 'primary') {
      return (
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={baseStyle}
        >
          {renderContent()}
        </LinearGradient>
      );
    }

    // Secondary variant with solid background
    if (variant === 'secondary') {
      return (
        <View style={[baseStyle, { backgroundColor: theme.colors.secondary }]}>
          {renderContent()}
        </View>
      );
    }

    // Tertiary variant with transparent background
    if (variant === 'tertiary') {
      return <View style={[baseStyle, { backgroundColor: 'transparent' }]}>{renderContent()}</View>;
    }

    // Ghost variant with outline
    if (variant === 'ghost') {
      return (
        <View
          style={[
            baseStyle,
            {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          {renderContent()}
        </View>
      );
    }
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && styles.fullWidth]}>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!isInteractive}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={fullWidth && styles.fullWidth}
      >
        {renderButton()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  spinner: {
    marginRight: 8,
  },
});
