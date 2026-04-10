/**
 * Toast Notification System
 *
 * A toast notification component for displaying transient feedback messages.
 * Supports success, error, and info variants with auto-dismiss and queuing.
 *
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10, 24.11
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignSystem } from '../theme/useDesignSystem';
import { Icon } from './Icon';

/**
 * Toast variant types
 */
export type ToastVariant = 'success' | 'error' | 'info';

/**
 * Toast message interface
 */
export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

/**
 * Global toast function type
 */
type ShowToastFunction = (message: string, variant: ToastVariant, duration?: number) => void;

/**
 * Extend global interface to include showToast
 */
declare global {
  // eslint-disable-next-line no-var
  var showToast: ShowToastFunction | undefined;
}

/**
 * Toast component props
 */
interface ToastProps {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}

/**
 * Single Toast component with slide-in animation
 */
const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  const { theme } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Announce toast message to screen readers
    // Requirement 14.11: Announce toast notifications
    const variantLabel =
      message.variant === 'success'
        ? 'Success'
        : message.variant === 'error'
          ? 'Error'
          : 'Information';
    AccessibilityInfo.announceForAccessibility(`${variantLabel}: ${message.message}`);

    // Slide in animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after duration (default 3000ms)
    // Requirement 24.5: Auto-dismiss after 3000ms
    const duration = message.duration || 3000;
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Handle dismiss with slide-out animation
   * Requirement 24.6: Manual dismissal support
   */
  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(message.id);
    });
  };

  /**
   * Get toast colors based on variant
   * Requirements: 24.7, 24.8, 24.9
   */
  const getToastColors = () => {
    switch (message.variant) {
      case 'success':
        return {
          backgroundColor: `${theme.colors.secondary}1A`, // 10% opacity
          borderColor: theme.colors.secondary,
          iconColor: theme.colors.secondary,
          icon: 'check-circle' as const,
        };
      case 'error':
        return {
          backgroundColor: `${theme.colors.error}1A`, // 10% opacity
          borderColor: theme.colors.error,
          iconColor: theme.colors.error,
          icon: 'error' as const,
        };
      case 'info':
        return {
          backgroundColor: `${theme.colors.primary}1A`, // 10% opacity
          borderColor: theme.colors.primary,
          iconColor: theme.colors.primary,
          icon: 'info' as const,
        };
    }
  };

  const colors = getToastColors();

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          transform: [{ translateY }],
          opacity,
          // Requirement 24.10: Position at bottom above BottomNavBar
          bottom: 110 + insets.bottom, // Above bottom nav (80px) + padding
        },
      ]}
    >
      <Icon name={colors.icon} size={20} color={colors.iconColor} />
      <Text
        style={[
          styles.message,
          {
            color: theme.colors.onSurface,
            fontFamily: theme.typography.fonts.body,
            fontSize: theme.typography.sizes.bodyMd,
          },
        ]}
      >
        {message.message}
      </Text>
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessible={true}
        accessibilityLabel="Dismiss notification"
        accessibilityHint="Double tap to dismiss this notification"
        accessibilityRole="button"
      >
        <Icon name="close" size={18} color={theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Toast Container component manages toast queue
 * Requirement 24.11: Queue multiple toasts and display sequentially
 */
export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * Add toast to queue
   */
  const addToast = (message: string, variant: ToastVariant, duration?: number) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
  };

  /**
   * Remove toast from queue
   */
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Expose addToast globally for easy access
  useEffect(() => {
    global.showToast = addToast;
    return () => {
      delete global.showToast;
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast} onDismiss={removeToast} />
      ))}
    </View>
  );
};

/**
 * Helper function to show toast notifications
 * Usage: showToast('Message', 'success')
 */
export const showToast = (message: string, variant: ToastVariant = 'info', duration?: number) => {
  if (global.showToast) {
    global.showToast(message, variant, duration);
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: Dimensions.get('window').width - 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  message: {
    flex: 1,
    lineHeight: 20,
  },
});
