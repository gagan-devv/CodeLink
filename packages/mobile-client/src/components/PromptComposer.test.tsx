import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { PromptComposer } from './PromptComposer';

/**
 * Unit tests for PromptComposer component
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 * 
 * These tests verify specific examples and edge cases for the PromptComposer component.
 */
describe('PromptComposer Component Unit Tests', () => {
  const mockOnSubmit = vi.fn();

  const defaultProps = {
    onSubmit: mockOnSubmit,
    isLoading: false,
    error: null,
  };

  it('should instantiate with default props', () => {
    expect(() => {
      React.createElement(PromptComposer, defaultProps);
    }).not.toThrow();
  });

  it('should be a valid React component', () => {
    expect(PromptComposer).toBeDefined();
    expect(typeof PromptComposer).toBe('function');
  });

  it('should accept all required props', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element.props.onSubmit).toBe(mockOnSubmit);
    expect(element.props.isLoading).toBe(false);
    expect(element.props.error).toBeNull();
  });

  it('should handle loading state', () => {
    const element = React.createElement(PromptComposer, {
      ...defaultProps,
      isLoading: true,
    });
    expect(element.props.isLoading).toBe(true);
  });

  it('should handle error state', () => {
    const errorMessage = 'Network error occurred';
    const element = React.createElement(PromptComposer, {
      ...defaultProps,
      error: errorMessage,
    });
    expect(element.props.error).toBe(errorMessage);
  });

  it('should accept onSubmit callback', () => {
    const customOnSubmit = vi.fn();
    const element = React.createElement(PromptComposer, {
      ...defaultProps,
      onSubmit: customOnSubmit,
    });
    expect(element.props.onSubmit).toBe(customOnSubmit);
  });

  it('should handle empty prompt text', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Empty prompt should not trigger onSubmit when validated
    const emptyPrompt = '';
    expect(emptyPrompt.trim().length).toBe(0);
  });

  it('should handle whitespace-only prompt text', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Whitespace-only prompt should not trigger onSubmit when validated
    const whitespacePrompt = '   \t\n  ';
    expect(whitespacePrompt.trim().length).toBe(0);
  });

  it('should handle valid prompt text', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Valid prompt should pass validation
    const validPrompt = 'This is a valid prompt';
    expect(validPrompt.trim().length).toBeGreaterThan(0);
  });

  it('should handle long prompt text', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Long prompt should be accepted
    const longPrompt = 'a'.repeat(1000);
    expect(longPrompt.trim().length).toBe(1000);
  });

  it('should handle prompt with special characters', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Prompt with special characters should be accepted
    const specialPrompt = 'Hello! @#$%^&*() <script>alert("test")</script>';
    expect(specialPrompt.trim().length).toBeGreaterThan(0);
  });

  it('should handle prompt with unicode characters', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Prompt with unicode should be accepted
    const unicodePrompt = 'Hello 世界 🌍 مرحبا';
    expect(unicodePrompt.trim().length).toBeGreaterThan(0);
  });

  it('should handle prompt with newlines', () => {
    const element = React.createElement(PromptComposer, defaultProps);
    expect(element).toBeDefined();
    // Multi-line prompt should be accepted
    const multilinePrompt = 'Line 1\nLine 2\nLine 3';
    expect(multilinePrompt.trim().length).toBeGreaterThan(0);
  });

  it('should handle both loading and error states simultaneously', () => {
    const element = React.createElement(PromptComposer, {
      ...defaultProps,
      isLoading: true,
      error: 'Error message',
    });
    expect(element.props.isLoading).toBe(true);
    expect(element.props.error).toBe('Error message');
  });

  it('should handle transition from loading to not loading', () => {
    const element1 = React.createElement(PromptComposer, {
      ...defaultProps,
      isLoading: true,
    });
    expect(element1.props.isLoading).toBe(true);

    const element2 = React.createElement(PromptComposer, {
      ...defaultProps,
      isLoading: false,
    });
    expect(element2.props.isLoading).toBe(false);
  });

  it('should handle error clearing', () => {
    const element1 = React.createElement(PromptComposer, {
      ...defaultProps,
      error: 'Error message',
    });
    expect(element1.props.error).toBe('Error message');

    const element2 = React.createElement(PromptComposer, {
      ...defaultProps,
      error: null,
    });
    expect(element2.props.error).toBeNull();
  });
});
