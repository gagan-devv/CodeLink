/**
 * StatusIndicator Component
 *
 * A status indicator component that displays connection status with color-coded dots.
 * Supports connected, disconnected, and connecting states with pulse animation.
 *
 * Requirements: 10.6, 3.10, 3.11, 9.6, 9.7, 9.8
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { useDesignSystem } from '../theme/useDesignSystem';

/**
 * Connection status types
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

/**
 * Status indicator size variants
 */
export type StatusIndicatorSize = 'sm' | 'md' | 'lg';

export interface StatusIndicatorProps {
  /**
   * Current connection status
   */
  status: ConnectionStatus;

  /**
   * Show label text next to indicator
   * @default false
   */
  showLabel?: boolean;

  /**
   * Size variant
   * @default 'md'
   */
  size?: StatusIndicatorSize;

  /**
   * Enable pulse animation for connecting state
   * @default true
   */
  animated?: boolean;

  /**
   * Custom style overrides
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Accessibility label for screen readers
   * If not provided, uses status label as accessibility label
   */
  accessibilityLabel?: string;
}

/**
 * StatusIndicator component with color-coded status and pulse animation
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showLabel = false,
  size = 'md',
  animated = true,
  style,
  accessibilityLabel,
}) => {
  const { theme } = useDesignSystem();
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  /**
   * Start pulse animation for connecting state
   */
  useEffect(() => {
    if (status === 'connecting' && animated) {
      // Create looping pulse animation
      const pulseAnimation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, {
              toValue: 1.5,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseScale, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0.5,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      pulseAnimation.start();

      // Cleanup animation on unmount or status change
      return () => {
        pulseAnimation.stop();
        pulseScale.setValue(1);
        pulseOpacity.setValue(1);
      };
    } else {
      // Reset animation values for non-connecting states
      pulseScale.setValue(1);
      pulseOpacity.setValue(1);
    }
  }, [status, animated, pulseScale, pulseOpacity]);

  /**
   * Get dot size based on size variant
   */
  const getDotSize = (): number => {
    switch (size) {
      case 'sm':
        return 8;
      case 'md':
        return 10;
      case 'lg':
        return 12;
    }
  };

  /**
   * Get status color based on connection status
   */
  const getStatusColor = (): string => {
    switch (status) {
      case 'connected':
        return theme.colors.secondary; // Green
      case 'disconnected':
        return theme.colors.error; // Red
      case 'connecting':
        return theme.colors.tertiary; // Orange
    }
  };

  /**
   * Get status label text
   */
  const getStatusLabel = (): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting';
    }
  };

  const dotSize = getDotSize();
  const statusColor = getStatusColor();
  const statusLabel = getStatusLabel();

  return (
    <View
      style={[styles.container, style]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `Connection status: ${statusLabel}`}
      accessibilityRole="text"
    >
      {/* Status dot with optional pulse animation */}
      <View style={styles.dotContainer}>
        <Animated.View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: statusColor,
              transform: status === 'connecting' && animated ? [{ scale: pulseScale }] : [],
              opacity: status === 'connecting' && animated ? pulseOpacity : 1,
            },
          ]}
        />
      </View>

      {/* Optional label */}
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: statusColor,
              fontFamily: theme.typography.fonts.label,
              fontSize: theme.typography.sizes.labelMd,
              fontWeight: String(theme.typography.weights.medium) as
                | '400'
                | '500'
                | '600'
                | '700'
                | '800',
            },
          ]}
        >
          {statusLabel}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    // Size and color set dynamically
  },
  label: {
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
