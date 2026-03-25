import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, HelperText, IconButton, Menu, Chip, Portal, Modal } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useOrientation } from '../hooks';
import { useDraftPrompt } from '../hooks/useDraftPrompt';
import { usePromptHistory } from '../hooks/usePromptHistory';
import { PromptTemplates } from './PromptTemplates';

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
  const { draft, setDraft, clearDraft, isSaving, lastSaved } = useDraftPrompt();
  const { history, addToHistory } = usePromptHistory();
  const [prompt, setPrompt] = useState(draft);
  const [charCount, setCharCount] = useState(draft.length);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { isLandscape } = useOrientation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);

  const MAX_CHARS = 5000;
  const WARNING_THRESHOLD = 0.8;

  // Sync with draft
  useEffect(() => {
    setDraft(prompt);
  }, [prompt, setDraft]);

  /**
   * Handle text input changes
   * Updates prompt state and character count
   * Requirement 1.2: Real-time character count feedback
   */
  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setPrompt(text);
      setCharCount(text.length);
      
      // Clear validation error when user starts typing
      if (validationError) {
        setValidationError(null);
      }
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
  const handleSubmit = async () => {
    if (!validatePrompt(prompt)) {
      return;
    }
    
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Add to history
    await addToHistory({
      id: Date.now().toString(),
      prompt,
      timestamp: Date.now(),
    });
    
    onSubmit(prompt);
    
    // Clear draft after successful submission
    await clearDraft();
    setPrompt('');
    setCharCount(0);
  };

  /**
   * Handle template selection
   */
  const handleSelectTemplate = (template: string) => {
    setPrompt(template);
    setCharCount(template.length);
    setTemplatesVisible(false);
  };

  /**
   * Handle history item selection
   */
  const handleSelectHistory = (item: string) => {
    setPrompt(item);
    setCharCount(item.length);
    setHistoryVisible(false);
  };

  /**
   * Clear current prompt
   */
  const handleClear = () => {
    Alert.alert(
      'Clear Prompt',
      'Are you sure you want to clear the current prompt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setPrompt('');
            setCharCount(0);
            await clearDraft();
          },
        },
      ]
    );
  };

  const isNearLimit = charCount >= MAX_CHARS * WARNING_THRESHOLD;
  const isAtLimit = charCount >= MAX_CHARS;

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={[
        styles.container,
        isLandscape && styles.containerLandscape
      ]}
    >
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <IconButton
            icon="history"
            size={20}
            onPress={() => setHistoryVisible(true)}
            disabled={history.length === 0}
          />
          <IconButton
            icon="file-document-outline"
            size={20}
            onPress={() => setTemplatesVisible(true)}
          />
        </View>
        <View style={styles.toolbarRight}>
          {isSaving && <Text style={styles.savingText}>Saving...</Text>}
          {lastSaved && !isSaving && (
            <Text style={styles.savedText}>Saved</Text>
          )}
          <IconButton
            icon="delete-outline"
            size={20}
            onPress={handleClear}
            disabled={prompt.length === 0}
          />
        </View>
      </View>

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
        error={!!validationError || !!error || isAtLimit}
      />

      {/* Character count display */}
      {/* Requirement 1.2: Real-time character count feedback */}
      <View style={styles.charCountContainer}>
        <Text style={[
          styles.charCount,
          isNearLimit && styles.charCountWarning,
          isAtLimit && styles.charCountError
        ]}>
          {charCount} / {MAX_CHARS} characters
        </Text>
        {isNearLimit && !isAtLimit && (
          <Chip size="small" style={styles.warningChip}>
            Approaching limit
          </Chip>
        )}
        {isAtLimit && (
          <Chip size="small" style={styles.errorChip}>
            Character limit reached
          </Chip>
        )}
      </View>

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
        disabled={isLoading || prompt.trim().length === 0 || isAtLimit}
        loading={isLoading}
        style={styles.submitButton}
        contentStyle={styles.buttonContent}
        icon="send"
      >
        {isLoading ? 'Submitting...' : 'Submit Prompt'}
      </Button>

      {/* History Modal */}
      <Portal>
        <Modal
          visible={historyVisible}
          onDismiss={() => setHistoryVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Prompt History
          </Text>
          <ScrollView style={styles.historyList}>
            {history.map((item) => (
              <Button
                key={item.id}
                mode="outlined"
                onPress={() => handleSelectHistory(item.prompt)}
                style={styles.historyItem}
              >
                {item.prompt.substring(0, 100)}...
              </Button>
            ))}
          </ScrollView>
          <Button onPress={() => setHistoryVisible(false)}>Close</Button>
        </Modal>
      </Portal>

      {/* Templates Modal */}
      <Portal>
        <Modal
          visible={templatesVisible}
          onDismiss={() => setTemplatesVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <PromptTemplates onSelectTemplate={handleSelectTemplate} />
          <Button onPress={() => setTemplatesVisible(false)} style={styles.closeButton}>
            Close
          </Button>
        </Modal>
      </Portal>
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolbarLeft: {
    flexDirection: 'row',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  savedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginRight: 8,
  },
  input: {
    marginBottom: 8,
    minHeight: 150,
  },
  inputLandscape: {
    minHeight: 100,
  },
  charCountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
  },
  charCountWarning: {
    color: '#FF9800',
    fontWeight: '600',
  },
  charCountError: {
    color: '#F44336',
    fontWeight: '600',
  },
  warningChip: {
    backgroundColor: '#FFF3E0',
  },
  errorChip: {
    backgroundColor: '#FFEBEE',
  },
  submitButton: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  historyList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  historyItem: {
    marginBottom: 8,
    justifyContent: 'flex-start',
  },
  closeButton: {
    marginTop: 8,
  },
});
