/**
 * Toggle Component
 *
 * A toggle switch component with label, description, and haptic feedback.
 * Supports enabled/disabled states with design system colors.
 *
 * Requirements: 10.5, 7.4, 12.10
 */

import React from 'react';
import { View, Switch, Text, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../theme/useDesignSystem';

export interface ToggleProps {
  /**
   * Current toggle value
   */
  value: boolean;

  /**
   * Callback when value changes
   */
  onValueChange: (value: boolean) => void;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Label text displayed above the toggle
   */
  label?: string;

  /**
   * Description text displayed below the label
   */
  description?: string;

  /**
   * Enable haptic feedback on value change
   * @default true
   */
  hapticFeedback?: boolean;

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
   * Provides additional context about what the toggle controls
   */
  accessibilityHint?: string;
}

/**
 * Toggle switch component with label and description
 */
export const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  label,
  description,
  hapticFeedback = true,
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { theme } = useDesignSystem();

  /**
   * Handle value change with haptic feedback
   */
  const handleValueChange = (newValue: boolean) => {
    if (disabled) return;

    // Trigger haptic feedback
    if (hapticFeedback && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      Haptics.selectionAsync();
    }

    onValueChange(newValue);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Label and description section */}
      {(label || description) && (
        <View style={styles.textContainer}>
          {label && (
            <Text
              style={[
                styles.label,
                {
                  color: disabled ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                  fontFamily: theme.typography.fonts.body,
                  fontSize: theme.typography.sizes.bodyLg,
                  fontWeight: String(theme.typography.weights.medium) as
                    | '400'
                    | '500'
                    | '600'
                    | '700'
                    | '800',
                },
              ]}
            >
              {label}
            </Text>
          )}
          {description && (
            <Text
              style={[
                styles.description,
                {
                  color: theme.colors.onSurfaceVariant,
                  fontFamily: theme.typography.fonts.body,
                  fontSize: theme.typography.sizes.bodySm,
                  fontWeight: String(theme.typography.weights.regular) as
                    | '400'
                    | '500'
                    | '600'
                    | '700'
                    | '800',
                },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      )}

      {/* Toggle switch */}
      <Switch
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        trackColor={{
          false: theme.colors.surfaceContainerHighest,
          true: theme.colors.secondary,
        }}
        thumbColor={value ? theme.colors.onSecondary : theme.colors.onSurfaceVariant}
        ios_backgroundColor={theme.colors.surfaceContainerHighest}
        style={styles.switch}
        accessible={true}
        accessibilityLabel={accessibilityLabel || label || 'Toggle switch'}
        accessibilityHint={accessibilityHint}
        accessibilityRole="switch"
        accessibilityState={{
          disabled,
          checked: value,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44, // Minimum touch target size
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    marginBottom: 4,
  },
  description: {
    lineHeight: 18,
  },
  switch: {
    // Platform-specific adjustments handled by React Native
  },
});
