import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorType,
  formatErrorMessage,
  getActionableSteps,
  createAppError,
  logError,
  discriminateErrorType,
  createErrorDisplay,
  handleError,
  handleUnknownError,
} from './errorHandling';

describe('Error Handling Unit Tests', () => {
  describe('formatErrorMessage', () => {
    it('should format network error message', () => {
      const error = createAppError(ErrorType.NETWORK_ERROR, 'Connection timeout');
      const message = formatErrorMessage(error);
      
      expect(message).toContain('Network error');
      expect(message).toContain('internet connection');
    });

    it('should format prompt submission error with specific reason', () => {
      const specificReason = 'Server rejected the prompt';
      const error = createAppError(ErrorType.PROMPT_SUBMISSION_ERROR, specificReason);
      const message = formatErrorMessage(error);
      
      expect(message).toContain('Failed to submit prompt');
      expect(message).toContain(specificReason);
    });

    it('should format connection error message', () => {
      const error = createAppError(ErrorType.CONNECTION_ERROR, 'Socket disconnected');
      const message = formatErrorMessage(error);
      
      expect(message).toContain('Connection failed');
      expect(message).toContain('relay server');
    });

    it('should format validation error message', () => {
      const validationMessage = 'Prompt cannot be empty';
      const error = createAppError(ErrorType.VALIDATION_ERROR, validationMessage);
      const message = formatErrorMessage(error);
      
      expect(message).toBe(validationMessage);
    });

    it('should format parsing error message', () => {
      const error = createAppError(ErrorType.PARSING_ERROR, 'Invalid JSON');
      const message = formatErrorMessage(error);
      
      expect(message).toContain('Unable to process');
      expect(message).toContain('corrupted');
    });

    it('should format unexpected error message', () => {
      const error = createAppError(ErrorType.UNEXPECTED_ERROR, 'Unknown issue');
      const message = formatErrorMessage(error);
      
      expect(message).toContain('unexpected error');
      expect(message).toContain('try again');
    });
  });

  describe('getActionableSteps', () => {
    it('should return network-related steps for network errors', () => {
      const error = createAppError(ErrorType.NETWORK_ERROR, 'Network timeout');
      const steps = getActionableSteps(error);
      
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some(step => step.toLowerCase().includes('internet') || step.toLowerCase().includes('connection'))).toBe(true);
    });

    it('should return connection-related steps for connection errors', () => {
      const error = createAppError(ErrorType.CONNECTION_ERROR, 'Connection failed');
      const steps = getActionableSteps(error);
      
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some(step => step.toLowerCase().includes('server') || step.toLowerCase().includes('reconnect'))).toBe(true);
    });

    it('should return custom actionable steps when provided', () => {
      const customSteps = ['Step 1', 'Step 2', 'Step 3'];
      const error = createAppError(ErrorType.NETWORK_ERROR, 'Error', undefined, customSteps);
      const steps = getActionableSteps(error);
      
      expect(steps).toEqual(customSteps);
    });

    it('should return default steps for unexpected errors', () => {
      const error = createAppError(ErrorType.UNEXPECTED_ERROR, 'Unknown error');
      const steps = getActionableSteps(error);
      
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some(step => step.toLowerCase().includes('try again') || step.toLowerCase().includes('restart'))).toBe(true);
    });
  });

  describe('createAppError', () => {
    it('should create error with all required fields', () => {
      const type = ErrorType.NETWORK_ERROR;
      const message = 'Test error';
      const originalError = new Error('Original');
      const actionableSteps = ['Step 1'];
      
      const error = createAppError(type, message, originalError, actionableSteps);
      
      expect(error.type).toBe(type);
      expect(error.message).toBe(message);
      expect(error.originalError).toBe(originalError);
      expect(error.actionableSteps).toEqual(actionableSteps);
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    it('should create error without optional fields', () => {
      const error = createAppError(ErrorType.VALIDATION_ERROR, 'Validation failed');
      
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBe('Validation failed');
      expect(error.originalError).toBeUndefined();
      expect(error.actionableSteps).toBeUndefined();
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('logError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should log error message', () => {
      const error = createAppError(ErrorType.NETWORK_ERROR, 'Network error');
      logError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('NETWORK_ERROR');
      expect(loggedMessage).toContain('Network error');
    });

    it('should log original error in development', () => {
      const originalError = new Error('Original error');
      const error = createAppError(ErrorType.UNEXPECTED_ERROR, 'Unexpected', originalError);
      
      logError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include timestamp in log message', () => {
      const error = createAppError(ErrorType.CONNECTION_ERROR, 'Connection failed');
      logError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp format
    });
  });

  describe('discriminateErrorType', () => {
    it('should identify network errors from error messages', () => {
      const networkErrors = [
        new Error('Network timeout'),
        new Error('Fetch failed'),
        new Error('Network error occurred'),
      ];
      
      networkErrors.forEach(error => {
        expect(discriminateErrorType(error)).toBe(ErrorType.NETWORK_ERROR);
      });
    });

    it('should identify connection errors from error messages', () => {
      const connectionErrors = [
        new Error('Connection refused'),
        new Error('Socket disconnected'),
        new Error('Connection failed'),
      ];
      
      connectionErrors.forEach(error => {
        expect(discriminateErrorType(error)).toBe(ErrorType.CONNECTION_ERROR);
      });
    });

    it('should identify validation errors from error messages', () => {
      const validationErrors = [
        new Error('Validation failed'),
        new Error('Invalid input'),
        new Error('Validation error'),
      ];
      
      validationErrors.forEach(error => {
        expect(discriminateErrorType(error)).toBe(ErrorType.VALIDATION_ERROR);
      });
    });

    it('should identify parsing errors from error messages', () => {
      const parsingErrors = [
        new Error('Parse error'),
        new Error('JSON syntax error'),
        new Error('Failed to parse'),
      ];
      
      parsingErrors.forEach(error => {
        expect(discriminateErrorType(error)).toBe(ErrorType.PARSING_ERROR);
      });
    });

    it('should return UNEXPECTED_ERROR for unknown error types', () => {
      const unknownErrors = [
        new Error('Something went wrong'),
        new Error('Random error'),
        { message: 'Not an Error object' },
        'String error',
        null,
        undefined,
      ];
      
      unknownErrors.forEach(error => {
        expect(discriminateErrorType(error)).toBe(ErrorType.UNEXPECTED_ERROR);
      });
    });
  });

  describe('createErrorDisplay', () => {
    it('should create display for network error', () => {
      const error = createAppError(ErrorType.NETWORK_ERROR, 'Network timeout');
      const display = createErrorDisplay(error);
      
      expect(display.title).toBe('Network Error');
      expect(display.message).toBeTruthy();
      expect(display.actionableSteps.length).toBeGreaterThan(0);
      expect(display.severity).toBe('error');
    });

    it('should create display for validation error with warning severity', () => {
      const error = createAppError(ErrorType.VALIDATION_ERROR, 'Invalid input');
      const display = createErrorDisplay(error);
      
      expect(display.title).toBe('Validation Error');
      expect(display.severity).toBe('warning');
    });

    it('should create display for connection error', () => {
      const error = createAppError(ErrorType.CONNECTION_ERROR, 'Connection failed');
      const display = createErrorDisplay(error);
      
      expect(display.title).toBe('Connection Failed');
      expect(display.severity).toBe('error');
    });

    it('should create display for prompt submission error', () => {
      const error = createAppError(ErrorType.PROMPT_SUBMISSION_ERROR, 'Submission failed');
      const display = createErrorDisplay(error);
      
      expect(display.title).toBe('Submission Failed');
      expect(display.severity).toBe('error');
    });
  });

  describe('handleError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should create error, log it, and return display', () => {
      const display = handleError(ErrorType.NETWORK_ERROR, 'Network error');
      
      expect(display.title).toBeTruthy();
      expect(display.message).toBeTruthy();
      expect(display.actionableSteps.length).toBeGreaterThan(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle custom actionable steps', () => {
      const customSteps = ['Custom step 1', 'Custom step 2'];
      const display = handleError(
        ErrorType.CONNECTION_ERROR,
        'Connection error',
        undefined,
        customSteps
      );
      
      expect(display.actionableSteps).toEqual(customSteps);
    });
  });

  describe('handleUnknownError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      const display = handleUnknownError(error);
      
      // The display message is formatted based on error type, not the original message
      expect(display.message).toBeTruthy();
      expect(display.title).toBeTruthy();
      expect(display.actionableSteps.length).toBeGreaterThan(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      const display = handleUnknownError({ unknown: 'object' });
      
      expect(display.message).toBeTruthy();
      expect(display.message).not.toContain('[object Object]');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle null and undefined', () => {
      const displayNull = handleUnknownError(null);
      const displayUndefined = handleUnknownError(undefined);
      
      expect(displayNull.message).toBeTruthy();
      expect(displayUndefined.message).toBeTruthy();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle string errors', () => {
      const display = handleUnknownError('String error');
      
      expect(display.message).toBeTruthy();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should discriminate error type correctly', () => {
      const networkError = new Error('Network timeout');
      const display = handleUnknownError(networkError);
      
      expect(display.title).toBe('Network Error');
    });
  });
});
