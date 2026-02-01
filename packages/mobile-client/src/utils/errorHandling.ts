/**
 * Error handling utilities for the mobile client
 * Provides error message formatting, display helpers, and logging
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

/**
 * Error types that can occur in the mobile client
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROMPT_SUBMISSION_ERROR = 'PROMPT_SUBMISSION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
}

/**
 * Structured error information
 */
export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error | unknown;
  actionableSteps?: string[];
  timestamp: number;
}

/**
 * Format an error into a user-friendly message
 * Requirement 9.1: Display user-friendly error messages for network errors
 * Requirement 9.2: Display specific error reason for prompt submission failures
 * Requirement 9.3: Display connection troubleshooting guidance
 * Requirement 9.4: Log and display generic message for unexpected errors
 */
export function formatErrorMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      return 'Network error occurred. Please check your internet connection and try again.';
    
    case ErrorType.PROMPT_SUBMISSION_ERROR:
      return `Failed to submit prompt: ${error.message}`;
    
    case ErrorType.CONNECTION_ERROR:
      return 'Connection failed. Please check your network settings and ensure the relay server is accessible.';
    
    case ErrorType.VALIDATION_ERROR:
      return error.message;
    
    case ErrorType.PARSING_ERROR:
      return 'Unable to process server response. The data may be corrupted.';
    
    case ErrorType.UNEXPECTED_ERROR:
      return 'An unexpected error occurred. Please try again.';
    
    default:
      return 'An error occurred. Please try again.';
  }
}

/**
 * Get actionable next steps for an error
 * Requirement 9.5: Provide actionable next steps where applicable
 */
export function getActionableSteps(error: AppError): string[] {
  if (error.actionableSteps && error.actionableSteps.length > 0) {
    return error.actionableSteps;
  }

  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      return [
        'Check your internet connection',
        'Try switching between WiFi and mobile data',
        'Restart the app',
      ];
    
    case ErrorType.CONNECTION_ERROR:
      return [
        'Verify the relay server is running',
        'Check your network settings',
        'Try reconnecting manually',
        'Contact support if the issue persists',
      ];
    
    case ErrorType.PROMPT_SUBMISSION_ERROR:
      return [
        'Review your prompt for any issues',
        'Try submitting again',
        'Check your connection status',
      ];
    
    case ErrorType.VALIDATION_ERROR:
      return [
        'Review the validation message',
        'Correct the input and try again',
      ];
    
    case ErrorType.PARSING_ERROR:
      return [
        'Request fresh data from the server',
        'Restart the app if the issue persists',
      ];
    
    case ErrorType.UNEXPECTED_ERROR:
      return [
        'Try the action again',
        'Restart the app if the issue persists',
        'Contact support if the problem continues',
      ];
    
    default:
      return ['Try again', 'Restart the app if the issue persists'];
  }
}

/**
 * Create an AppError from various error sources
 */
export function createAppError(
  type: ErrorType,
  message: string,
  originalError?: Error | unknown,
  actionableSteps?: string[]
): AppError {
  return {
    type,
    message,
    originalError,
    actionableSteps,
    timestamp: Date.now(),
  };
}

/**
 * Log an error with appropriate detail level
 * Requirement 9.4: Log errors for debugging
 */
export function logError(error: AppError): void {
  const logMessage = `[${new Date(error.timestamp).toISOString()}] ${error.type}: ${error.message}`;
  
  // Check if __DEV__ is defined (React Native environment)
  const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    // In development, log full error details
    console.error(logMessage);
    if (error.originalError) {
      console.error('Original error:', error.originalError);
    }
    if (error.actionableSteps) {
      console.log('Actionable steps:', error.actionableSteps);
    }
  } else {
    // In production, log minimal information
    console.error(logMessage);
  }
}

/**
 * Discriminate error type from various error sources
 */
export function discriminateErrorType(error: unknown): ErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('connection') || message.includes('socket') || message.includes('disconnect')) {
      return ErrorType.CONNECTION_ERROR;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }
    
    if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
      return ErrorType.PARSING_ERROR;
    }
  }
  
  return ErrorType.UNEXPECTED_ERROR;
}

/**
 * Create a user-friendly error display object
 */
export interface ErrorDisplay {
  title: string;
  message: string;
  actionableSteps: string[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Convert an AppError to an ErrorDisplay for UI rendering
 */
export function createErrorDisplay(error: AppError): ErrorDisplay {
  const message = formatErrorMessage(error);
  const actionableSteps = getActionableSteps(error);
  
  let title: string;
  let severity: 'error' | 'warning' | 'info' = 'error';
  
  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      title = 'Network Error';
      break;
    case ErrorType.CONNECTION_ERROR:
      title = 'Connection Failed';
      break;
    case ErrorType.PROMPT_SUBMISSION_ERROR:
      title = 'Submission Failed';
      break;
    case ErrorType.VALIDATION_ERROR:
      title = 'Validation Error';
      severity = 'warning';
      break;
    case ErrorType.PARSING_ERROR:
      title = 'Data Error';
      break;
    case ErrorType.UNEXPECTED_ERROR:
      title = 'Error';
      break;
    default:
      title = 'Error';
  }
  
  return {
    title,
    message,
    actionableSteps,
    severity,
  };
}

/**
 * Handle an error by logging it and creating a display object
 */
export function handleError(
  type: ErrorType,
  message: string,
  originalError?: Error | unknown,
  actionableSteps?: string[]
): ErrorDisplay {
  const appError = createAppError(type, message, originalError, actionableSteps);
  logError(appError);
  return createErrorDisplay(appError);
}

/**
 * Handle an unknown error by discriminating its type and creating a display object
 */
export function handleUnknownError(error: unknown): ErrorDisplay {
  const type = discriminateErrorType(error);
  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  const appError = createAppError(type, message, error);
  logError(appError);
  return createErrorDisplay(appError);
}
