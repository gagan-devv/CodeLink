/**
 * Skeleton Component
 *
 * A loading placeholder component with shimmer animation.
 * Used to indicate content is loading.
 *
 * Requirements: 15.10
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { useDesignSystem } from '../theme/useDesignSystem';

export interface SkeletonProps {
  /**
   * Width of skeleton (number for pixels, string for percentage)
   */
  width?: number | string;

  /**
   * Height of skeleton (number for pixels, string for percentage)
   */
  height?: number | string;

  /**
   * Make skeleton circular
   * @default false
   */
  circle?: boolean;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * Skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  circle = false,
  style,
}) => {
  const { theme } = useDesignSystem();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  /**
   * Start shimmer animation on mount
   */
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    shimmer.start();

    return () => {
      shimmer.stop();
    };
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const borderRadius = circle
    ? typeof height === 'number'
      ? height / 2
      : 9999
    : theme.borderRadius.md;

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height: height as DimensionValue,
          borderRadius,
          backgroundColor: theme.colors.surfaceContainerHigh,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
