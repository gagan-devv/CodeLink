import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useOrientation } from '../hooks';

/**
 * PromptComposer component props
 */
export interface PromptComposerProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * PromptComposer component for composing and submitting prompts
 * Provides real-time character count, validation, and loading states
 * Supports both portrait and landscape orientations with responsive layout
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5, 10.1, 10.2, 10.4, 10.5
 */
export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSubmit,
  isLoading,
  error
}) => {
  const [prompt, setPrompt] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { isLandscape } = useOrientation();

  /**
   * Handle text input changes
   * Updates prompt state and character count
   * Requirement 1.2: Real-time character count feedback
   */
  const handleTextChange = (text: string) => {
    setPrompt(text);
    setCharCount(text.length);
    
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  };

  /**
   * Validate prompt before submission
   * Requirement 1.4: Reject empty/whitespace prompts
   */
  const validatePrompt = (text: string): boolean => {
    if (text.trim().length === 0) {
      setValidationError('Prompt cannot be empty or contain only whitespace');
      return false;
    }
    return true;
  };

  /**
   * Handle prompt submission
   * Requirement 1.3: Create INJECT_PROMPT message
   * Requirement 1.4: Prevent submission of empty prompts
   */
  const handleSubmit = () => {
    if (!validatePrompt(prompt)) {
      return;
    }
    
    onSubmit(prompt);
  };

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={[
        styles.container,
        isLandscape && styles.containerLandscape
      ]}
    >
      {/* Multiline text input for prompt composition */}
      {/* Requirement 1.1: Multi-line prompt input */}
      {/* Requirement 10.4: Accessible in both orientations */}
      <TextInput
        mode="outlined"
        label="Enter your prompt"
        placeholder="Type your prompt here..."
        value={prompt}
        onChangeText={handleTextChange}
        multiline
        numberOfLines={isLandscape ? 4 : 8}
        disabled={isLoading}
        style={[styles.input, isLandscape && styles.inputLandscape]}
        error={!!validationError || !!error}
      />

      {/* Character count display */}
      {/* Requirement 1.2: Real-time character count feedback */}
      <Text style={styles.charCount}>{charCount} characters</Text>

      {/* Validation error display */}
      {/* Requirement 1.4: Display validation message */}
      {validationError && (
        <HelperText type="error" visible={true}>
          {validationError}
        </HelperText>
      )}

      {/* External error display */}
      {error && (
        <HelperText type="error" visible={true}>
          {error}
        </HelperText>
      )}

      {/* Submit button with loading state */}
      {/* Requirement 1.5: Disable button and show loading indicator during submission */}
      {/* Requirement 10.4: Accessible in both orientations */}
      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={isLoading || prompt.trim().length === 0}
        loading={isLoading}
        style={styles.submitButton}
        contentStyle={styles.buttonContent}
      >
        {isLoading ? 'Submitting...' : 'Submit Prompt'}
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  containerLandscape: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  input: {
    marginBottom: 8,
    minHeight: 150,
  },
  inputLandscape: {
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
