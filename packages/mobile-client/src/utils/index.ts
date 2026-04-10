// Utility functions for the mobile client
// This file will contain helper functions and utilities

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Export message validation utilities
export {
  isInjectPromptMessage,
  isInjectPromptResponse,
  isSyncFullContextMessage,
  validateProtocolMessage,
  discriminateMessageType,
} from './messageValidation';

// Export error handling utilities
export {
  ErrorType,
  type AppError,
  type ErrorDisplay,
  formatErrorMessage,
  getActionableSteps,
  createAppError,
  logError,
  discriminateErrorType,
  createErrorDisplay,
  handleError,
  handleUnknownError,
} from './errorHandling';

// Export platform adaptation utilities
export {
  type PlatformType,
  getCurrentPlatform,
  isIOS,
  isAndroid,
  isWeb,
  getStatusBarStyle,
  getActivityIndicatorSize,
  triggerHapticFeedback,
  registerBackButtonHandler,
  getKeyboardBehavior,
  getKeyboardVerticalOffset,
  supportsSwipeBack,
  hasHardwareBackButton,
  getNavigationGestureConfig,
} from './platformAdaptations';

// Export responsive layout utilities
export {
  BREAKPOINTS,
  MAX_CONTENT_WIDTH,
  MIN_TOUCH_TARGET_SIZE,
  type ScreenSize,
  getScreenDimensions,
  getScreenSize,
  getGridColumns,
  getBentoGridConfig,
  getContentWidth,
  getTypographyScale,
  scaleFont,
  scaleSpacing,
  ensureMinTouchTarget,
  getResponsivePadding,
  isLargeScreen,
  isSmallScreen,
  getPixelRatio,
  dpToPixels,
  pixelsToDp,
} from './responsiveLayout';
