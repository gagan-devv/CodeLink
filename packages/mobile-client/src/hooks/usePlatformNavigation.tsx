/**
 * Platform-specific navigation configuration hook
 *
 * Requirements:
 * - 26.5: Platform-specific navigation gestures
 * - 26.6: iOS swipe-back gesture support
 * - 26.7: Android hardware back button support
 */

import { useMemo } from 'react';
import { supportsSwipeBack, getNavigationGestureConfig } from '../utils/platformAdaptations';

interface PlatformNavigationOptions {
  gestureEnabled: boolean;
  gestureDirection: string;
  animation: 'slide_from_right';
  animationDuration: number;
  animationTypeForReplace: 'push';
  headerShown: boolean;
}

/**
 * Hook to get platform-specific navigation options
 *
 * @returns Navigation options configured for the current platform
 */
export const usePlatformNavigation = (): PlatformNavigationOptions => {
  const navigationOptions = useMemo(() => {
    const gestureConfig = getNavigationGestureConfig();

    return {
      // Requirement 26.6: iOS swipe-back gesture support
      gestureEnabled: supportsSwipeBack() ? gestureConfig.gestureEnabled : false,
      gestureDirection: gestureConfig.gestureDirection,

      // Screen transition animations (Requirements 12.1, 12.2)
      animation: 'slide_from_right' as const,
      animationDuration: 300,
      animationTypeForReplace: 'push' as const,

      // Header configuration
      headerShown: false, // We use custom TopAppBar
    };
  }, []);

  return navigationOptions;
};
