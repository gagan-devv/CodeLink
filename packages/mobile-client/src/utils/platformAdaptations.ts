/**
 * Platform-specific adaptations for iOS and Android
 *
 * Requirements:
 * - 26.1: Platform-specific status bar styling
 * - 26.2: Platform-specific safe area insets
 * - 26.3: Platform-specific keyboard behavior
 * - 26.4: Platform-specific haptic feedback patterns
 * - 26.5: Platform-specific navigation gestures
 * - 26.6: iOS swipe-back gesture support
 * - 26.7: Android hardware back button support
 * - 26.8: iOS-style activity indicator
 * - 26.9: Android Material Design activity indicator
 */

import { Platform, BackHandler } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Platform type
 */
export type PlatformType = 'ios' | 'android' | 'web' | 'other';

/**
 * Get current platform
 */
export const getCurrentPlatform = (): PlatformType => {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'other';
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => Platform.OS === 'ios';

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => Platform.OS === 'android';

/**
 * Check if running on web
 */
export const isWeb = (): boolean => Platform.OS === 'web';

/**
 * Get platform-specific status bar style
 * Requirement 26.1: Platform-specific status bar styling
 */
export const getStatusBarStyle = (isDark: boolean): 'light' | 'dark' | 'auto' => {
  if (isIOS()) {
    // iOS uses light content for dark backgrounds, dark content for light backgrounds
    return isDark ? 'light' : 'dark';
  }

  if (isAndroid()) {
    // Android also follows the same pattern
    return isDark ? 'light' : 'dark';
  }

  return 'auto';
};

/**
 * Get platform-specific activity indicator size
 * Requirements 26.8, 26.9: Platform-specific activity indicators
 */
export const getActivityIndicatorSize = (): 'small' | 'large' => {
  // Both platforms use the same sizes, but rendering differs
  return 'large';
};

/**
 * Haptic feedback patterns for different platforms
 * Requirement 26.4: Platform-specific haptic feedback patterns
 */
export const triggerHapticFeedback = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection'
): Promise<void> => {
  try {
    if (isIOS()) {
      // iOS haptic patterns
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
      }
    } else if (isAndroid()) {
      // Android haptic patterns (more subtle)
      switch (type) {
        case 'light':
        case 'selection':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
        case 'success':
        case 'error':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    }
  } catch (error) {
    // Gracefully handle haptic feedback errors
    console.warn('Haptic feedback not available:', error);
  }
};

/**
 * Register Android hardware back button handler
 * Requirement 26.7: Android hardware back button support
 *
 * @param handler Function to call when back button is pressed
 * @returns Cleanup function to remove the handler
 */
export const registerBackButtonHandler = (handler: () => boolean): (() => void) => {
  if (isAndroid()) {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }

  // No-op for other platforms
  return () => {};
};

/**
 * Get platform-specific keyboard behavior settings
 * Requirement 26.3: Platform-specific keyboard behavior
 */
export const getKeyboardBehavior = (): 'padding' | 'height' | 'position' | undefined => {
  if (isIOS()) {
    return 'padding';
  }

  if (isAndroid()) {
    return 'height';
  }

  return undefined;
};

/**
 * Get platform-specific keyboard vertical offset
 * Requirement 26.3: Platform-specific keyboard behavior
 */
export const getKeyboardVerticalOffset = (hasHeader: boolean = true): number => {
  if (isIOS()) {
    // iOS needs offset for header height
    return hasHeader ? 64 : 0;
  }

  // Android doesn't need offset
  return 0;
};

/**
 * Check if platform supports swipe-back gesture
 * Requirement 26.6: iOS swipe-back gesture support
 */
export const supportsSwipeBack = (): boolean => {
  return isIOS();
};

/**
 * Check if platform has hardware back button
 * Requirement 26.7: Android hardware back button support
 */
export const hasHardwareBackButton = (): boolean => {
  return isAndroid();
};

/**
 * Get platform-specific navigation gesture config
 * Requirement 26.5: Platform-specific navigation gestures
 */
export const getNavigationGestureConfig = () => {
  if (isIOS()) {
    return {
      gestureEnabled: true,
      gestureDirection: 'horizontal' as const,
    };
  }

  if (isAndroid()) {
    return {
      gestureEnabled: false, // Android uses hardware back button
      gestureDirection: 'horizontal' as const,
    };
  }

  return {
    gestureEnabled: false,
    gestureDirection: 'horizontal' as const,
  };
};
