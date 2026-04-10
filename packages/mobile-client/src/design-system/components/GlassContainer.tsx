/**
 * Glass Container Component
 *
 * A container with glassmorphism effect using backdrop blur.
 * Provides a frosted glass visual effect for floating elements.
 *
 * Requirements:
 * - 11.1: Apply backdrop-blur effect to Bottom_Navigation bar
 * - 11.2: Apply backdrop-blur effect to modal overlays
 * - 11.3: Apply backdrop-blur effect to floating action buttons
 * - 11.4: Use 20px blur radius for glassmorphism effects
 * - 11.5: Use 80-90% opacity for glass surfaces
 * - 11.6: Layer glass effects over surface-variant background
 * - 11.7: Fallback to solid background when backdrop-blur not supported
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignSystem } from '../theme/useDesignSystem';

/**
 * Glass container props
 */
export interface GlassContainerProps {
  /**
   * Child components to render inside the glass container
   */
  children: ReactNode;

  /**
   * Blur intensity (0-100)
   * @default 80
   */
  intensity?: number;

  /**
   * Tint color for the blur
   * @default 'dark'
   */
  tint?: 'light' | 'dark' | 'default';

  /**
   * Background opacity (0-1)
   * @default 0.8
   */
  opacity?: number;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Whether to use fallback solid background on unsupported platforms
   * @default true
   */
  useFallback?: boolean;
}

/**
 * Glass container component with glassmorphism effect
 *
 * Uses BlurView for backdrop blur on supported platforms (iOS, Android).
 * Falls back to semi-transparent solid background on web or when blur is not supported.
 */
export const GlassContainer: React.FC<GlassContainerProps> = ({
  children,
  intensity = 80,
  tint = 'dark',
  opacity = 0.8,
  style,
  useFallback = true,
}) => {
  const { theme } = useDesignSystem();

  // Check if platform supports blur
  const supportsBlur = Platform.OS === 'ios' || Platform.OS === 'android';

  // Fallback background color with opacity
  const fallbackBackgroundColor = `${theme.colors.surfaceVariant}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;

  if (!supportsBlur && useFallback) {
    // Fallback for platforms without blur support (Requirement 11.7)
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: fallbackBackgroundColor,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // Glass effect with BlurView (Requirements 11.4, 11.5, 11.6)
  return (
    <View style={[styles.container, style]}>
      {/* Backdrop blur layer */}
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />

      {/* Semi-transparent background overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: fallbackBackgroundColor,
          },
        ]}
      />

      {/* Content layer */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});
