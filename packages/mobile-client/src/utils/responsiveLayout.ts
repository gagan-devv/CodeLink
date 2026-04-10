/**
 * Responsive Layout Utilities
 *
 * Provides utilities for responsive layouts that adapt to different
 * screen sizes and orientations.
 *
 * Requirements:
 * - 13.1: Support portrait orientation on all screens
 * - 13.2: Support landscape orientation on all screens
 * - 13.3: Use maximum content width of 1024px on large screens
 * - 13.4: Center content horizontally on wide screens
 * - 13.5: Use responsive grid layouts (1 column on small, 2-3 on medium/large)
 * - 13.6: Adjust bento grid layout based on orientation
 * - 13.7: Adjust typography scales based on screen size
 * - 13.8: Maintain minimum touch target size of 44x44pt on all screen sizes
 * - 13.9: Re-layout content smoothly on orientation change
 */

import { Dimensions, PixelRatio } from 'react-native';
import type { Orientation } from '../hooks/useOrientation';

/**
 * Screen size breakpoints (in dp/pt)
 */
export const BREAKPOINTS = {
  small: 0, // 0-599dp (phones in portrait)
  medium: 600, // 600-839dp (large phones, small tablets)
  large: 840, // 840-1023dp (tablets)
  xlarge: 1024, // 1024dp+ (large tablets, desktops)
} as const;

/**
 * Maximum content width for large screens (in dp/pt)
 * Requirement 13.3: Use maximum content width of 1024px on large screens
 */
export const MAX_CONTENT_WIDTH = 1024;

/**
 * Minimum touch target size (in dp/pt)
 * Requirement 13.8: Maintain minimum touch target size of 44x44pt
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Screen size category
 */
export type ScreenSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * Get current screen dimensions
 */
export const getScreenDimensions = () => {
  return Dimensions.get('window');
};

/**
 * Get screen size category based on width
 *
 * @param width Screen width in dp/pt
 * @returns Screen size category
 */
export const getScreenSize = (width: number): ScreenSize => {
  if (width >= BREAKPOINTS.xlarge) return 'xlarge';
  if (width >= BREAKPOINTS.large) return 'large';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'small';
};

/**
 * Get number of grid columns based on screen size
 * Requirement 13.5: Use responsive grid layouts (1 column on small, 2-3 on medium/large)
 *
 * @param screenSize Screen size category
 * @param orientation Current orientation
 * @returns Number of columns for grid layout
 */
export const getGridColumns = (screenSize: ScreenSize, orientation: Orientation): number => {
  if (screenSize === 'small') {
    return orientation === 'portrait' ? 1 : 2;
  }

  if (screenSize === 'medium') {
    return orientation === 'portrait' ? 2 : 3;
  }

  // large and xlarge
  return orientation === 'portrait' ? 2 : 3;
};

/**
 * Get bento grid configuration based on screen size and orientation
 * Requirement 13.6: Adjust bento grid layout based on orientation
 *
 * @param screenSize Screen size category
 * @param orientation Current orientation
 * @returns Bento grid configuration
 */
export const getBentoGridConfig = (screenSize: ScreenSize, orientation: Orientation) => {
  const isSmall = screenSize === 'small';
  const isPortrait = orientation === 'portrait';

  return {
    // Use single column on small screens in portrait
    columns: isSmall && isPortrait ? 1 : 2,

    // Asymmetrical sizing for bento pattern
    largeCardSpan: isSmall && isPortrait ? 1 : 2,
    smallCardSpan: 1,

    // Gap between cards
    gap: isSmall ? 12 : 16,

    // Padding around grid
    padding: isSmall ? 16 : 24,
  };
};

/**
 * Get content container width with max width constraint
 * Requirement 13.3: Use maximum content width of 1024px on large screens
 * Requirement 13.4: Center content horizontally on wide screens
 *
 * @param screenWidth Current screen width
 * @returns Content width and whether it should be centered
 */
export const getContentWidth = (screenWidth: number) => {
  const shouldConstrain = screenWidth > MAX_CONTENT_WIDTH;

  return {
    width: shouldConstrain ? MAX_CONTENT_WIDTH : screenWidth,
    shouldCenter: shouldConstrain,
    marginHorizontal: shouldConstrain ? (screenWidth - MAX_CONTENT_WIDTH) / 2 : 0,
  };
};

/**
 * Get typography scale multiplier based on screen size
 * Requirement 13.7: Adjust typography scales based on screen size
 *
 * @param screenSize Screen size category
 * @returns Scale multiplier for font sizes
 */
export const getTypographyScale = (screenSize: ScreenSize): number => {
  switch (screenSize) {
    case 'small':
      return 0.9; // Slightly smaller on small screens
    case 'medium':
      return 1.0; // Base scale
    case 'large':
      return 1.05; // Slightly larger on large screens
    case 'xlarge':
      return 1.1; // Larger on extra large screens
  }
};

/**
 * Scale a font size based on screen size
 *
 * @param baseSize Base font size
 * @param screenSize Screen size category
 * @returns Scaled font size
 */
export const scaleFont = (baseSize: number, screenSize: ScreenSize): number => {
  return Math.round(baseSize * getTypographyScale(screenSize));
};

/**
 * Get spacing value based on screen size
 *
 * @param baseSpacing Base spacing value
 * @param screenSize Screen size category
 * @returns Scaled spacing value
 */
export const scaleSpacing = (baseSpacing: number, screenSize: ScreenSize): number => {
  const scale = screenSize === 'small' ? 0.875 : 1.0;
  return Math.round(baseSpacing * scale);
};

/**
 * Ensure touch target meets minimum size requirement
 * Requirement 13.8: Maintain minimum touch target size of 44x44pt
 *
 * @param size Desired size
 * @returns Size that meets minimum requirement
 */
export const ensureMinTouchTarget = (size: number): number => {
  return Math.max(size, MIN_TOUCH_TARGET_SIZE);
};

/**
 * Get responsive padding based on screen size
 *
 * @param screenSize Screen size category
 * @returns Padding values for different screen sizes
 */
export const getResponsivePadding = (screenSize: ScreenSize) => {
  switch (screenSize) {
    case 'small':
      return { horizontal: 16, vertical: 12 };
    case 'medium':
      return { horizontal: 24, vertical: 16 };
    case 'large':
    case 'xlarge':
      return { horizontal: 32, vertical: 20 };
  }
};

/**
 * Check if screen is considered large
 *
 * @param width Screen width
 * @returns True if screen is large or xlarge
 */
export const isLargeScreen = (width: number): boolean => {
  return getScreenSize(width) === 'large' || getScreenSize(width) === 'xlarge';
};

/**
 * Check if screen is considered small
 *
 * @param width Screen width
 * @returns True if screen is small
 */
export const isSmallScreen = (width: number): boolean => {
  return getScreenSize(width) === 'small';
};

/**
 * Get pixel ratio for the current device
 */
export const getPixelRatio = (): number => {
  return PixelRatio.get();
};

/**
 * Convert dp/pt to pixels
 *
 * @param dp Value in dp/pt
 * @returns Value in pixels
 */
export const dpToPixels = (dp: number): number => {
  return PixelRatio.getPixelSizeForLayoutSize(dp);
};

/**
 * Convert pixels to dp/pt
 *
 * @param pixels Value in pixels
 * @returns Value in dp/pt
 */
export const pixelsToDp = (pixels: number): number => {
  return pixels / PixelRatio.get();
};
