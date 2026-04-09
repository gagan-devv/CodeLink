/**
 * Bottom Tab Navigator
 *
 * Configures bottom tab navigation with screen transition animations
 * and design system integration.
 *
 * Requirements: 12.1, 12.2
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

/**
 * Bottom tab navigator instance
 */
const Tab = createBottomTabNavigator();

/**
 * Default screen options for bottom tab navigator.
 * Configures screen transition animations with 300ms duration and ease-in-out timing.
 *
 * Requirements: 12.1, 12.2
 */
export const defaultScreenOptions: BottomTabNavigationOptions = {
  // Animation configuration
  animation: 'shift', // Smooth shift animation for tab transitions

  // Header configuration (will be customized per screen)
  headerShown: false,

  // Tab bar configuration (will be customized with custom component)
  tabBarHideOnKeyboard: true,
};

/**
 * Screen transition configuration
 * 300ms duration with ease-in-out timing function
 */
export const transitionConfig = {
  animation: 'timing' as const,
  config: {
    duration: 300,
    easing: (t: number) => {
      // Ease-in-out cubic bezier approximation
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
  },
};

/**
 * Export the Tab navigator for use in app
 */
export { Tab };
