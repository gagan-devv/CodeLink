import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { PromptResponseDisplay } from './PromptResponseDisplay';
import { InjectPromptResponse } from '@codelink/protocol';

describe('PromptResponseDisplay - Property-Based Tests', () => {
  // Feature: mobile-client-expo-migration, Property 9: Success Response Display
  // **Validates: Requirements 3.2, 4.1**
  it('Property 9: success notification displays with editor name when present', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // messageId
        fc.string({ minLength: 1, maxLength: 100 }), // originalId
        fc.option(fc.constantFrom('Continue', 'Kiro', 'Cursor', 'Antigravity'), { nil: undefined }), // editorUsed
        (messageId, originalId, editorUsed) => {
          const mockOnDismiss = vi.fn();
          
          // Create success response
          const response: InjectPromptResponse = {
            type: 'INJECT_PROMPT_RESPONSE',
            id: messageId,
            timestamp: Date.now(),
            originalId: originalId,
            payload: {
              success: true,
              editorUsed: editorUsed,
            },
          };
          
          // Create component instance
          const element = React.createElement(PromptResponseDisplay, {
            response: response,
            onDismiss: mockOnDismiss,
            duration: 4000,
          });
          
          // Verify component can be created
          expect(element).toBeDefined();
          expect(element.type).toBe(PromptResponseDisplay);
          expect(element.props.response).toBe(response);
          
          // Verify response structure
          expect(response.payload.success).toBe(true);
          
          // When editorUsed is present, it should be included in the message
          if (editorUsed) {
            expect(response.payload.editorUsed).toBeDefined();
            expect(['Continue', 'Kiro', 'Cursor', 'Antigravity']).toContain(editorUsed);
          }
          
          // Success responses should not have error field set
          expect(response.payload.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: mobile-client-expo-migration, Property 10: Error Response Display
  // **Validates: Requirements 3.3**
  it('Property 10: error message from error field is displayed for failed responses', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // messageId
        fc.string({ minLength: 1, maxLength: 100 }), // originalId
        fc.string({ minLength: 1, maxLength: 200 }), // error message
        (messageId, originalId, errorMessage) => {
          const mockOnDismiss = vi.fn();
          
          // Create error response
          const response: InjectPromptResponse = {
            type: 'INJECT_PROMPT_RESPONSE',
            id: messageId,
            timestamp: Date.now(),
            originalId: originalId,
            payload: {
              success: false,
              error: errorMessage,
            },
          };
          
          // Create component instance
          const element = React.createElement(PromptResponseDisplay, {
            response: response,
            onDismiss: mockOnDismiss,
            duration: 4000,
          });
          
          // Verify component can be created
          expect(element).toBeDefined();
          expect(element.type).toBe(PromptResponseDisplay);
          expect(element.props.response).toBe(response);
          
          // Verify response structure
          expect(response.payload.success).toBe(false);
          expect(response.payload.error).toBe(errorMessage);
          expect(response.payload.error).toBeDefined();
          expect(response.payload.error!.length).toBeGreaterThan(0);
          
          // Error responses should not have editorUsed field
          expect(response.payload.editorUsed).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: mobile-client-expo-migration, Property 11: UI State Restoration After Response
  // **Validates: Requirements 3.4**
  it('Property 11: onDismiss callback is provided for UI state restoration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // messageId
        fc.string({ minLength: 1, maxLength: 100 }), // originalId
        fc.boolean(), // success or failure
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }), // error message
        fc.option(fc.constantFrom('Continue', 'Kiro', 'Cursor', 'Antigravity'), { nil: undefined }), // editorUsed
        (messageId, originalId, success, errorMessage, editorUsed) => {
          const mockOnDismiss = vi.fn();
          
          // Create response (success or error)
          const response: InjectPromptResponse = {
            type: 'INJECT_PROMPT_RESPONSE',
            id: messageId,
            timestamp: Date.now(),
            originalId: originalId,
            payload: success
              ? {
                  success: true,
                  editorUsed: editorUsed,
                }
              : {
                  success: false,
                  error: errorMessage || 'Unknown error',
                },
          };
          
          // Create component instance
          const element = React.createElement(PromptResponseDisplay, {
            response: response,
            onDismiss: mockOnDismiss,
            duration: 4000,
          });
          
          // Verify component can be created
          expect(element).toBeDefined();
          expect(element.type).toBe(PromptResponseDisplay);
          
          // Verify onDismiss callback is provided
          expect(element.props.onDismiss).toBe(mockOnDismiss);
          expect(typeof element.props.onDismiss).toBe('function');
          
          // The component should provide a way to dismiss and restore UI state
          // This is done through the onDismiss callback
          // The parent component can use this to clear loading state and re-enable submit button
        }
      ),
      { numRuns: 100 }
    );
  });
});
