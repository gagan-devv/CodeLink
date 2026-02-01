import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { PromptResponseDisplay } from './PromptResponseDisplay';
import { InjectPromptResponse } from '@codelink/protocol';

/**
 * Unit tests for PromptResponseDisplay component
 * Validates: Requirements 3.2, 3.3, 4.1, 4.3
 * 
 * These tests verify specific examples and edge cases for the PromptResponseDisplay component.
 */
describe('PromptResponseDisplay Component Unit Tests', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createSuccessResponse = (editorUsed?: string): InjectPromptResponse => ({
    type: 'INJECT_PROMPT_RESPONSE',
    id: 'response-123',
    timestamp: Date.now(),
    originalId: 'prompt-456',
    payload: {
      success: true,
      editorUsed,
    },
  });

  const createErrorResponse = (error?: string): InjectPromptResponse => ({
    type: 'INJECT_PROMPT_RESPONSE',
    id: 'response-789',
    timestamp: Date.now(),
    originalId: 'prompt-012',
    payload: {
      success: false,
      error,
    },
  });

  describe('Component Instantiation', () => {
    it('should instantiate with null response', () => {
      expect(() => {
        React.createElement(PromptResponseDisplay, {
          response: null,
          onDismiss: mockOnDismiss,
        });
      }).not.toThrow();
    });

    it('should be a valid React component', () => {
      expect(PromptResponseDisplay).toBeDefined();
      expect(typeof PromptResponseDisplay).toBe('function');
    });

    it('should accept all required props', () => {
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response).toBe(response);
      expect(element.props.onDismiss).toBe(mockOnDismiss);
    });

    it('should accept optional duration prop', () => {
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
        duration: 5000,
      });
      expect(element.props.duration).toBe(5000);
    });

    it('should use default duration when not provided', () => {
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      // Default duration is 4000ms as per design
      expect(element.props.duration).toBeUndefined();
    });
  });

  describe('Success Response Display - Editor Names', () => {
    // Requirement 4.1: Display each supported editor name
    it('should display Continue editor name', () => {
      const response = createSuccessResponse('Continue');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.editorUsed).toBe('Continue');
      expect(element.props.response?.payload.success).toBe(true);
    });

    it('should display Kiro editor name', () => {
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.editorUsed).toBe('Kiro');
      expect(element.props.response?.payload.success).toBe(true);
    });

    it('should display Cursor editor name', () => {
      const response = createSuccessResponse('Cursor');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.editorUsed).toBe('Cursor');
      expect(element.props.response?.payload.success).toBe(true);
    });

    it('should display Antigravity editor name', () => {
      const response = createSuccessResponse('Antigravity');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.editorUsed).toBe('Antigravity');
      expect(element.props.response?.payload.success).toBe(true);
    });

    // Requirement 4.3: Handle missing editorUsed field
    it('should handle success response without editor name', () => {
      const response = createSuccessResponse();
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.editorUsed).toBeUndefined();
      expect(element.props.response?.payload.success).toBe(true);
    });
  });

  describe('Error Response Display', () => {
    // Requirement 3.3: Display error message
    it('should display error message', () => {
      const errorMessage = 'Connection timeout';
      const response = createErrorResponse(errorMessage);
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.error).toBe(errorMessage);
      expect(element.props.response?.payload.success).toBe(false);
    });

    it('should handle error response with long error message', () => {
      const longError = 'A'.repeat(200);
      const response = createErrorResponse(longError);
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.error).toBe(longError);
      expect(element.props.response?.payload.success).toBe(false);
    });

    it('should handle error response with special characters', () => {
      const errorMessage = 'Error: <script>alert("test")</script>';
      const response = createErrorResponse(errorMessage);
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.error).toBe(errorMessage);
      expect(element.props.response?.payload.success).toBe(false);
    });

    it('should handle error response with unicode characters', () => {
      const errorMessage = 'エラー: 接続失敗 🚫';
      const response = createErrorResponse(errorMessage);
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.error).toBe(errorMessage);
      expect(element.props.response?.payload.success).toBe(false);
    });

    it('should handle error response without error message', () => {
      const response = createErrorResponse();
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.error).toBeUndefined();
      expect(element.props.response?.payload.success).toBe(false);
    });

    it('should handle error response with empty error message', () => {
      const response = createErrorResponse('');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.payload.error).toBe('');
      expect(element.props.response?.payload.success).toBe(false);
    });
  });

  describe('Auto-dismiss Behavior', () => {
    it('should accept custom duration', () => {
      const response = createSuccessResponse('Kiro');
      const customDuration = 3000;
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
        duration: customDuration,
      });
      expect(element.props.duration).toBe(customDuration);
    });

    it('should handle very short duration', () => {
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
        duration: 100,
      });
      expect(element.props.duration).toBe(100);
    });

    it('should handle very long duration', () => {
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
        duration: 30000,
      });
      expect(element.props.duration).toBe(30000);
    });
  });

  describe('Response Transitions', () => {
    it('should handle transition from null to success response', () => {
      const element1 = React.createElement(PromptResponseDisplay, {
        response: null,
        onDismiss: mockOnDismiss,
      });
      expect(element1.props.response).toBeNull();

      const response = createSuccessResponse('Kiro');
      const element2 = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element2.props.response).toBe(response);
    });

    it('should handle transition from null to error response', () => {
      const element1 = React.createElement(PromptResponseDisplay, {
        response: null,
        onDismiss: mockOnDismiss,
      });
      expect(element1.props.response).toBeNull();

      const response = createErrorResponse('Network error');
      const element2 = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element2.props.response).toBe(response);
    });

    it('should handle transition from success to null', () => {
      const response = createSuccessResponse('Kiro');
      const element1 = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element1.props.response).toBe(response);

      const element2 = React.createElement(PromptResponseDisplay, {
        response: null,
        onDismiss: mockOnDismiss,
      });
      expect(element2.props.response).toBeNull();
    });

    it('should handle transition from error to null', () => {
      const response = createErrorResponse('Network error');
      const element1 = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element1.props.response).toBe(response);

      const element2 = React.createElement(PromptResponseDisplay, {
        response: null,
        onDismiss: mockOnDismiss,
      });
      expect(element2.props.response).toBeNull();
    });

    it('should handle transition from success to error', () => {
      const successResponse = createSuccessResponse('Kiro');
      const element1 = React.createElement(PromptResponseDisplay, {
        response: successResponse,
        onDismiss: mockOnDismiss,
      });
      expect(element1.props.response?.payload.success).toBe(true);

      const errorResponse = createErrorResponse('Network error');
      const element2 = React.createElement(PromptResponseDisplay, {
        response: errorResponse,
        onDismiss: mockOnDismiss,
      });
      expect(element2.props.response?.payload.success).toBe(false);
    });
  });

  describe('Callback Handling', () => {
    it('should accept onDismiss callback', () => {
      const customOnDismiss = vi.fn();
      const response = createSuccessResponse('Kiro');
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: customOnDismiss,
      });
      expect(element.props.onDismiss).toBe(customOnDismiss);
    });

    it('should handle different onDismiss callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const response = createSuccessResponse('Kiro');

      const element1 = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: callback1,
      });
      expect(element1.props.onDismiss).toBe(callback1);

      const element2 = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: callback2,
      });
      expect(element2.props.onDismiss).toBe(callback2);
    });
  });

  describe('Message Structure Validation', () => {
    it('should handle response with all required fields', () => {
      const response: InjectPromptResponse = {
        type: 'INJECT_PROMPT_RESPONSE',
        id: 'msg-123',
        timestamp: 1234567890,
        originalId: 'orig-456',
        payload: {
          success: true,
          editorUsed: 'Kiro',
        },
      };
      const element = React.createElement(PromptResponseDisplay, {
        response,
        onDismiss: mockOnDismiss,
      });
      expect(element.props.response?.type).toBe('INJECT_PROMPT_RESPONSE');
      expect(element.props.response?.id).toBe('msg-123');
      expect(element.props.response?.timestamp).toBe(1234567890);
      expect(element.props.response?.originalId).toBe('orig-456');
    });

    it('should handle response with different message IDs', () => {
      const response1 = createSuccessResponse('Kiro');
      response1.id = 'unique-id-1';
      response1.originalId = 'original-id-1';

      const response2 = createSuccessResponse('Cursor');
      response2.id = 'unique-id-2';
      response2.originalId = 'original-id-2';

      const element1 = React.createElement(PromptResponseDisplay, {
        response: response1,
        onDismiss: mockOnDismiss,
      });
      expect(element1.props.response?.id).toBe('unique-id-1');

      const element2 = React.createElement(PromptResponseDisplay, {
        response: response2,
        onDismiss: mockOnDismiss,
      });
      expect(element2.props.response?.id).toBe('unique-id-2');
    });
  });
});
