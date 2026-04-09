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
