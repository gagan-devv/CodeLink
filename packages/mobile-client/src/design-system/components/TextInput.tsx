/**
 * TextInput Component
 *
 * A versatile text input component with focus states, error handling,
 * character counter, and support for multiline input.
 *
 * Requirements: 10.4, 5.4, 5.5, 5.13
 */

import React, { useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  KeyboardTypeOptions,
  PixelRatio,
} from 'react-native';
import { useDesignSystem } from '../theme/useDesignSystem';

export interface TextInputProps {
  /**
   * Current input value
   */
  value: string;

  /**
   * Callback when text changes
   */
  onChangeText: (text: string) => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Enable multiline input
   * @default false
   */
  multiline?: boolean;

  /**
   * Number of lines for multiline input
   * @default 4
   */
  numberOfLines?: number;

  /**
   * Maximum character length
   */
  maxLength?: number;

  /**
   * Keyboard type
   * @default 'default'
   */
  keyboardType?: KeyboardTypeOptions;

  /**
   * Auto-capitalization behavior
   * @default 'sentences'
   */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';

  /**
   * Enable auto-correction
   * @default true
   */
  autoCorrect?: boolean;

  /**
   * Whether input is editable
   * @default true
   */
  editable?: boolean;

  /**
   * Error message to display
   * When provided, input shows error state
   */
  error?: string;

  /**
   * Label text above input
   */
  label?: string;

  /**
   * Optional icon component to display
   */
  icon?: React.ReactNode;

  /**
   * Custom style overrides for container
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Custom style overrides for input
   */
  inputStyle?: StyleProp<TextStyle>;

  /**
   * Callback when input is focused
   */
  onFocus?: () => void;

  /**
   * Callback when input loses focus
   */
  onBlur?: () => void;

  /**
   * Accessibility label for screen readers
   * If not provided, uses label text as accessibility label
   */
  accessibilityLabel?: string;

  /**
   * Accessibility hint for screen readers
   * Provides additional context about the input field
   */
  accessibilityHint?: string;
}

/**
 * TextInput component with focus states and error handling
 */
export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numberOfLines = 4,
  maxLength,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  editable = true,
  error,
  label,
  icon,
  style,
  inputStyle,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { theme } = useDesignSystem();
  const [isFocused, setIsFocused] = useState(false);

  /**
   * Handle focus event
   */
  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  /**
   * Handle blur event
   */
  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  /**
   * Get background color based on state
   * - error: errorContainer background
   * - focused: surfaceBright background
   * - default: surfaceContainerHighest background
   */
  const getBackgroundColor = (): string => {
    if (error) {
      return theme.colors.errorContainer;
    }
    if (isFocused) {
      return theme.colors.surfaceBright;
    }
    return theme.colors.surfaceContainerHighest;
  };

  /**
   * Get border color based on state
   * - error: error border
   * - focused: primary border
   * - default: transparent
   */
  const getBorderColor = (): string => {
    if (error) {
      return theme.colors.error;
    }
    if (isFocused) {
      return theme.colors.primary;
    }
    return 'transparent';
  };

  /**
   * Get text color based on state
   */
  const getTextColor = (): string => {
    if (error) {
      return theme.colors.onErrorContainer;
    }
    return theme.colors.onSurface;
  };

  /**
   * Get placeholder color
   */
  const getPlaceholderColor = (): string => {
    return theme.colors.onSurfaceVariant;
  };

  /**
   * Check if character limit is exceeded
   */
  const isOverLimit = maxLength ? value.length > maxLength : false;

  /**
   * Get character counter color
   */
  const getCounterColor = (): string => {
    if (isOverLimit) {
      return theme.colors.error;
    }
    return theme.colors.onSurfaceVariant;
  };

  const backgroundColor = getBackgroundColor();
  const borderColor = getBorderColor();
  const textColor = getTextColor();
  const placeholderColor = getPlaceholderColor();
  const counterColor = getCounterColor();

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: error ? theme.colors.error : theme.colors.onSurface,
              fontSize: theme.typography.sizes.labelMd,
              fontFamily: theme.typography.fonts.label,
              fontWeight: String(theme.typography.weights.medium) as
                | '400'
                | '500'
                | '600'
                | '700'
                | '800',
              marginBottom: theme.spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor,
            borderColor,
            borderWidth: 1,
            borderRadius: theme.borderRadius.lg,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        {/* Icon */}
        {icon && <View style={styles.iconContainer}>{icon}</View>}

        {/* Text Input */}
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessible={true}
          accessibilityLabel={accessibilityLabel || label || placeholder || 'Text input'}
          accessibilityHint={accessibilityHint}
          accessibilityState={{
            disabled: !editable,
          }}
          style={[
            styles.input,
            {
              color: textColor,
              fontSize: theme.typography.sizes.bodyMd,
              fontFamily: theme.typography.fonts.body,
              fontWeight: String(theme.typography.weights.regular) as
                | '400'
                | '500'
                | '600'
                | '700'
                | '800',
              lineHeight: theme.typography.sizes.bodyMd * theme.typography.lineHeights.normal,
            },
            multiline && {
              minHeight:
                numberOfLines *
                theme.typography.sizes.bodyMd *
                theme.typography.lineHeights.normal *
                PixelRatio.getFontScale(),
              textAlignVertical: 'top',
            },
            inputStyle,
          ]}
        />
      </View>

      {/* Character Counter */}
      {maxLength && (
        <Text
          style={[
            styles.counter,
            {
              color: counterColor,
              fontSize: theme.typography.sizes.labelSm,
              fontFamily: theme.typography.fonts.label,
              fontWeight: String(theme.typography.weights.regular) as
                | '400'
                | '500'
                | '600'
                | '700'
                | '800',
              marginTop: theme.spacing.xs,
            },
          ]}
        >
          {value.length} / {maxLength}
        </Text>
      )}

      {/* Error Message */}
      {error && (
        <Text
          style={[
            styles.error,
            {
              color: theme.colors.error,
              fontSize: theme.typography.sizes.labelSm,
              fontFamily: theme.typography.fonts.body,
              fontWeight: String(theme.typography.weights.regular) as
                | '400'
                | '500'
                | '600'
                | '700'
                | '800',
              marginTop: theme.spacing.xs,
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 8,
    paddingTop: 2,
  },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
  counter: {
    textAlign: 'right',
  },
  error: {
    // Error message styling
  },
});
