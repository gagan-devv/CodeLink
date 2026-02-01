import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { InjectPromptResponse } from '@codelink/protocol';

/**
 * PromptResponseDisplay component props
 */
export interface PromptResponseDisplayProps {
  response: InjectPromptResponse | null;
  onDismiss: () => void;
  duration?: number;
}

/**
 * PromptResponseDisplay component for displaying prompt submission results
 * Shows success/error messages with editor identification
 * Auto-dismisses after configured duration
 * 
 * Requirements: 3.2, 3.3, 4.1, 4.3
 */
export const PromptResponseDisplay: React.FC<PromptResponseDisplayProps> = ({
  response,
  onDismiss,
  duration = 4000
}) => {
  // Auto-dismiss after duration
  useEffect(() => {
    if (response) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [response, duration, onDismiss]);

  if (!response) {
    return null;
  }

  const { success, error, editorUsed } = response.payload;

  /**
   * Format success message with editor name if available
   * Requirement 3.2: Display success notification with editor name
   * Requirement 4.1: Display editor name prominently
   */
  const getSuccessMessage = (): string => {
    if (editorUsed) {
      return `✓ Prompt processed successfully by ${editorUsed}`;
    }
    return '✓ Prompt processed successfully';
  };

  /**
   * Format error message
   * Requirement 3.3: Display error message from error field
   */
  const getErrorMessage = (): string => {
    return `✗ Error: ${error || 'Unknown error occurred'}`;
  };

  return (
    <Snackbar
      visible={true}
      onDismiss={onDismiss}
      duration={duration}
      style={success ? styles.success : styles.error}
      action={{
        label: 'Dismiss',
        onPress: onDismiss,
      }}
    >
      {success ? getSuccessMessage() : getErrorMessage()}
    </Snackbar>
  );
};

const styles = StyleSheet.create({
  success: {
    backgroundColor: '#4CAF50', // Green for success
  },
  error: {
    backgroundColor: '#F44336', // Red for error
  },
});
