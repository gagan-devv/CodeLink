/**
 * Responsive Layout Hook
 *
 * Combines orientation detection with responsive layout utilities
 * to provide a complete responsive layout solution.
 *
 * Requirements:
 * - 13.1: Support portrait orientation on all screens
 * - 13.2: Support landscape orientation on all screens
 * - 13.3: Use maximum content width of 1024px on large screens
 * - 13.4: Center content horizontally on wide screens
 * - 13.5: Use responsive grid layouts
 * - 13.6: Adjust bento grid layout based on orientation
 * - 13.7: Adjust typography scales based on screen size
 * - 13.9: Re-layout content smoothly on orientation change
 */

import { useMemo } from 'react';
import { useOrientation } from './useOrientation';
import {
  getScreenSize,
  getGridColumns,
  getBentoGridConfig,
  getContentWidth,
  getTypographyScale,
  getResponsivePadding,
  isLargeScreen,
  isSmallScreen,
  type ScreenSize,
} from '../utils/responsiveLayout';

/**
 * Responsive layout configuration
 */
export interface ResponsiveLayoutConfig {
  // Screen information
  screenSize: ScreenSize;
  isLargeScreen: boolean;
  isSmallScreen: boolean;

  // Orientation
  orientation: 'portrait' | 'landscape';
  isPortrait: boolean;
  isLandscape: boolean;

  // Dimensions
  width: number;
  height: number;

  // Content width
  contentWidth: number;
  shouldCenterContent: boolean;
  contentMarginHorizontal: number;

  // Grid configuration
  gridColumns: number;

  // Bento grid configuration
  bentoGrid: {
    columns: number;
    largeCardSpan: number;
    smallCardSpan: number;
    gap: number;
    padding: number;
  };

  // Typography scale
  typographyScale: number;

  // Padding
  padding: {
    horizontal: number;
    vertical: number;
  };
}

/**
 * Hook to get responsive layout configuration
 *
 * Automatically updates when screen size or orientation changes.
 * Requirement 13.9: Re-layout content smoothly on orientation change
 *
 * @returns Responsive layout configuration
 */
export const useResponsiveLayout = (): ResponsiveLayoutConfig => {
  const { orientation, isPortrait, isLandscape, width, height } = useOrientation();

  const config = useMemo(() => {
    const screenSize = getScreenSize(width);
    const contentWidthConfig = getContentWidth(width);
    const gridColumns = getGridColumns(screenSize, orientation);
    const bentoGrid = getBentoGridConfig(screenSize, orientation);
    const typographyScale = getTypographyScale(screenSize);
    const padding = getResponsivePadding(screenSize);

    return {
      // Screen information
      screenSize,
      isLargeScreen: isLargeScreen(width),
      isSmallScreen: isSmallScreen(width),

      // Orientation
      orientation,
      isPortrait,
      isLandscape,

      // Dimensions
      width,
      height,

      // Content width
      contentWidth: contentWidthConfig.width,
      shouldCenterContent: contentWidthConfig.shouldCenter,
      contentMarginHorizontal: contentWidthConfig.marginHorizontal,

      // Grid configuration
      gridColumns,

      // Bento grid configuration
      bentoGrid,

      // Typography scale
      typographyScale,

      // Padding
      padding,
    };
  }, [orientation, isPortrait, isLandscape, width, height]);

  return config;
};
