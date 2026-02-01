import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ErrorType,
  formatErrorMessage,
  getActionableSteps,
  createAppError,
  discriminateErrorType,
  createErrorDisplay,
  handleError,
  handleUnknownError,
  type AppError,
} from './errorHandling';

describe('Error Handling Property-Based Tests', () => {
  // Feature: mobile-client-expo-migration, Property 18: Error Message Display
  // Validates: Requirements 9.1, 9.2, 9.3, 9.4
  describe('Property 18: Error Message Display', () => {
    it('should format any error type into a user-friendly message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ErrorType.NETWORK_ERROR,
            ErrorType.PROMPT_SUBMISSION_ERROR,
            ErrorType.CONNECTION_ERROR,
            ErrorType.UNEXPECTED_ERROR,
            ErrorType.VALIDATION_ERROR,
            ErrorType.PARSING_ERROR
          ),
          fc.string({ minLength: 1 }),
          (errorType, errorMessage) => {
            const appError = createAppError(errorType, errorMessage);
            const formattedMessage = formatErrorMessage(appError);

            // Should return a non-empty string
            expect(formattedMessage).toBeTruthy();
            expect(typeof formattedMessage).toBe('string');
            expect(formattedMessage.length).toBeGreaterThan(0);

            // Should be user-friendly (no stack traces, technical jargon minimized)
            expect(formattedMessage).not.toContain('undefined');
            expect(formattedMessage).not.toContain('null');
            expect(formattedMessage).not.toContain('[object Object]');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide actionable steps for any error type', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ErrorType.NETWORK_ERROR,
            ErrorType.PROMPT_SUBMISSION_ERROR,
            ErrorType.CONNECTION_ERROR,
            ErrorType.UNEXPECTED_ERROR,
            ErrorType.VALIDATION_ERROR,
            ErrorType.PARSING_ERROR
          ),
          fc.string({ minLength: 1 }),
          (errorType, errorMessage) => {
            const appError = createAppError(errorType, errorMessage);
            const steps = getActionableSteps(appError);

            // Should return an array of steps
            expect(Array.isArray(steps)).toBe(true);
            expect(steps.length).toBeGreaterThan(0);

            // Each step should be a non-empty string
            steps.forEach((step) => {
              expect(typeof step).toBe('string');
              expect(step.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create error display with all required fields for any error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ErrorType.NETWORK_ERROR,
            ErrorType.PROMPT_SUBMISSION_ERROR,
            ErrorType.CONNECTION_ERROR,
            ErrorType.UNEXPECTED_ERROR,
            ErrorType.VALIDATION_ERROR,
            ErrorType.PARSING_ERROR
          ),
          fc.string({ minLength: 1 }),
          (errorType, errorMessage) => {
            const appError = createAppError(errorType, errorMessage);
            const display = createErrorDisplay(appError);

            // Should have all required fields
            expect(display).toHaveProperty('title');
            expect(display).toHaveProperty('message');
            expect(display).toHaveProperty('actionableSteps');
            expect(display).toHaveProperty('severity');

            // Title should be non-empty
            expect(typeof display.title).toBe('string');
            expect(display.title.length).toBeGreaterThan(0);

            // Message should be non-empty
            expect(typeof display.message).toBe('string');
            expect(display.message.length).toBeGreaterThan(0);

            // Actionable steps should be an array
            expect(Array.isArray(display.actionableSteps)).toBe(true);
            expect(display.actionableSteps.length).toBeGreaterThan(0);

            // Severity should be valid
            expect(['error', 'warning', 'info']).toContain(display.severity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle network errors with appropriate messaging (Requirement 9.1)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const display = handleError(
            ErrorType.NETWORK_ERROR,
            errorMessage
          );

          // Should indicate network issue
          const combinedText = `${display.title} ${display.message}`.toLowerCase();
          expect(
            combinedText.includes('network') ||
              combinedText.includes('internet') ||
              combinedText.includes('connection')
          ).toBe(true);

          // Should provide network-related actionable steps
          const stepsText = display.actionableSteps.join(' ').toLowerCase();
          expect(
            stepsText.includes('connection') ||
              stepsText.includes('network') ||
              stepsText.includes('internet')
          ).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle prompt submission errors with specific reasons (Requirement 9.2)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (specificReason) => {
          const display = handleError(
            ErrorType.PROMPT_SUBMISSION_ERROR,
            specificReason
          );

          // Should include the specific error reason in the message
          expect(display.message).toContain(specificReason);

          // Should indicate submission failure
          const combinedText = `${display.title} ${display.message}`.toLowerCase();
          expect(
            combinedText.includes('submit') ||
              combinedText.includes('submission') ||
              combinedText.includes('failed')
          ).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle connection errors with troubleshooting guidance (Requirement 9.3)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const display = handleError(
            ErrorType.CONNECTION_ERROR,
            errorMessage
          );

          // Should indicate connection issue
          const combinedText = `${display.title} ${display.message}`.toLowerCase();
          expect(
            combinedText.includes('connection') ||
              combinedText.includes('connect')
          ).toBe(true);

          // Should provide troubleshooting steps
          expect(display.actionableSteps.length).toBeGreaterThan(0);
          const stepsText = display.actionableSteps.join(' ').toLowerCase();
          expect(
            stepsText.includes('server') ||
              stepsText.includes('network') ||
              stepsText.includes('reconnect') ||
              stepsText.includes('settings')
          ).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle unexpected errors with generic messages (Requirement 9.4)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.constant(new Error('Test error')),
            fc.constant({ unknown: 'object' }),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (unknownError) => {
            const display = handleUnknownError(unknownError);

            // Should have a generic, user-friendly message
            expect(display.message).toBeTruthy();
            expect(typeof display.message).toBe('string');

            // Should not expose technical details
            expect(display.message).not.toContain('undefined');
            expect(display.message).not.toContain('[object Object]');

            // Should provide actionable steps
            expect(display.actionableSteps.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should discriminate error types from error messages', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({
              message: fc.constantFrom(
                'Network timeout',
                'Fetch failed',
                'Network error occurred'
              ),
              expectedType: fc.constant(ErrorType.NETWORK_ERROR),
            }),
            fc.record({
              message: fc.constantFrom(
                'Connection refused',
                'Socket disconnected',
                'Connection failed'
              ),
              expectedType: fc.constant(ErrorType.CONNECTION_ERROR),
            }),
            fc.record({
              message: fc.constantFrom(
                'Validation failed',
                'Invalid input',
                'Validation error'
              ),
              expectedType: fc.constant(ErrorType.VALIDATION_ERROR),
            }),
            fc.record({
              message: fc.constantFrom(
                'Parse error',
                'JSON syntax error',
                'Failed to parse'
              ),
              expectedType: fc.constant(ErrorType.PARSING_ERROR),
            })
          ),
          ({ message, expectedType }) => {
            const error = new Error(message);
            const discriminatedType = discriminateErrorType(error);

            // Should correctly identify the error type
            expect(discriminatedType).toBe(expectedType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve custom actionable steps when provided', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ErrorType.NETWORK_ERROR,
            ErrorType.PROMPT_SUBMISSION_ERROR,
            ErrorType.CONNECTION_ERROR,
            ErrorType.UNEXPECTED_ERROR,
            ErrorType.VALIDATION_ERROR,
            ErrorType.PARSING_ERROR
          ),
          fc.string({ minLength: 1 }),
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          (errorType, errorMessage, customSteps) => {
            const appError = createAppError(
              errorType,
              errorMessage,
              undefined,
              customSteps
            );
            const steps = getActionableSteps(appError);

            // Should return the custom steps
            expect(steps).toEqual(customSteps);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create errors with timestamps', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ErrorType.NETWORK_ERROR,
            ErrorType.PROMPT_SUBMISSION_ERROR,
            ErrorType.CONNECTION_ERROR,
            ErrorType.UNEXPECTED_ERROR,
            ErrorType.VALIDATION_ERROR,
            ErrorType.PARSING_ERROR
          ),
          fc.string({ minLength: 1 }),
          (errorType, errorMessage) => {
            const beforeTimestamp = Date.now();
            const appError = createAppError(errorType, errorMessage);
            const afterTimestamp = Date.now();

            // Should have a timestamp
            expect(appError.timestamp).toBeDefined();
            expect(typeof appError.timestamp).toBe('number');

            // Timestamp should be reasonable (within test execution time)
            expect(appError.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
            expect(appError.timestamp).toBeLessThanOrEqual(afterTimestamp);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain error type consistency through the handling pipeline', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ErrorType.NETWORK_ERROR,
            ErrorType.PROMPT_SUBMISSION_ERROR,
            ErrorType.CONNECTION_ERROR,
            ErrorType.UNEXPECTED_ERROR,
            ErrorType.VALIDATION_ERROR,
            ErrorType.PARSING_ERROR
          ),
          fc.string({ minLength: 1 }),
          (errorType, errorMessage) => {
            // Create error
            const appError = createAppError(errorType, errorMessage);
            expect(appError.type).toBe(errorType);

            // Format message
            const formattedMessage = formatErrorMessage(appError);
            expect(formattedMessage).toBeTruthy();

            // Get actionable steps
            const steps = getActionableSteps(appError);
            expect(steps.length).toBeGreaterThan(0);

            // Create display
            const display = createErrorDisplay(appError);
            expect(display).toBeTruthy();

            // All operations should succeed without changing the error type
            expect(appError.type).toBe(errorType);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
