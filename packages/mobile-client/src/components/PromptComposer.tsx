import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput as RNTextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../design-system/theme';
import { Text } from '../design-system/typography';
import { Icon, IconName } from '../design-system/components/Icon';
import { TopAppBar } from '../navigation/TopAppBar';
import { useDraftPrompt } from '../hooks/useDraftPrompt';
import { usePromptHistory } from '../hooks/usePromptHistory';

/**
 * Prompt template definition
 */
interface PromptTemplate {
  id: string;
  label: string;
  icon: IconName;
  iconColor: string;
  template: string;
}

/**
 * PromptComposer component props
 */
export interface PromptComposerProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  error: string | null;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
}

/**
 * PromptComposer component - Redesigned with Obsidian UI aesthetic
 * Features terminal-like interface, template chips, and floating action button
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13
 * Requirements: 25.1, 25.8, 12.6
 */
export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSubmit,
  isLoading,
  error,
  connectionStatus = 'connected',
}) => {
  const { theme } = useDesignSystem();
  const { draft, setDraft, clearDraft } = useDraftPrompt();
  const { addToHistory } = usePromptHistory();
  const [prompt, setPrompt] = useState(draft);
  const [charCount, setCharCount] = useState(draft.length);
  const fabScale = useRef(new Animated.Value(1)).current;

  const MAX_CHARS = 2000;

  // Template chips data
  // Requirement 5.2: Template chips (Refactor, Explain, Fix Bug, Write Tests, Documentation)
  const templates: PromptTemplate[] = [
    {
      id: 'refactor',
      label: 'Refactor',
      icon: 'build', // MaterialIcons equivalent for refactor/fix
      iconColor: theme.colors.primary,
      template: 'Refactor the following code to improve readability and maintainability:\n\n',
    },
    {
      id: 'explain',
      label: 'Explain',
      icon: 'description', // MaterialIcons icon for documentation/explanation
      iconColor: theme.colors.secondary,
      template: 'Explain what this code does:\n\n',
    },
    {
      id: 'fix-bug',
      label: 'Fix Bug',
      icon: 'bug-report', // MaterialIcons icon for bugs
      iconColor: theme.colors.error,
      template: 'Fix the bug in this code:\n\n',
    },
    {
      id: 'write-tests',
      label: 'Write Tests',
      icon: 'check-circle', // MaterialIcons equivalent for checklist/tests
      iconColor: theme.colors.tertiary,
      template: 'Write unit tests for this code:\n\n',
    },
    {
      id: 'documentation',
      label: 'Documentation',
      icon: 'school', // MaterialIcons equivalent for education/documentation
      iconColor: theme.colors.primaryContainer,
      template: 'Generate documentation for this code:\n\n',
    },
  ];

  // Sync with draft
  useEffect(() => {
    setDraft(prompt);
  }, [prompt, setDraft]);

  /**
   * Handle text input changes
   * Requirement 5.4: Multiline textarea with character counter
   * Requirement 5.5: Character counter showing current/maximum
   */
  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setPrompt(text);
      setCharCount(text.length);
    }
  };

  /**
   * Handle template chip selection
   * Requirement 5.11: Insert template text into textarea on tap
   */
  const handleSelectTemplate = async (template: PromptTemplate) => {
    await Haptics.selectionAsync();
    setPrompt(template.template);
    setCharCount(template.template.length);
  };

  /**
   * Handle clear button
   * Requirement 5.6: Clear button in bottom toolbar
   */
  const handleClear = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrompt('');
    setCharCount(0);
    await clearDraft();
  };

  /**
   * Handle attach button (placeholder for future implementation)
   * Requirement 5.6: Attach button in bottom toolbar
   */
  const handleAttach = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement file attachment functionality
  };

  /**
   * Handle FAB press animation
   * Requirement 12.6: Scale animation on FAB press
   */
  const handleFABPressIn = () => {
    Animated.spring(fabScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleFABPressOut = () => {
    Animated.spring(fabScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  /**
   * Handle prompt submission
   * Requirement 5.12: Send prompt action on FAB tap
   */
  const handleSubmit = async () => {
    if (prompt.trim().length === 0 || isLoading || charCount > MAX_CHARS) {
      return;
    }

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

  const isAtLimit = charCount >= MAX_CHARS;
  const canSubmit = prompt.trim().length > 0 && !isLoading && !isAtLimit;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Requirement 5.1: TopAppBar */}
      <TopAppBar connectionStatus={connectionStatus} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Requirement 5.1, 5.3: Active Context header with "Compose Prompt" title */}
        <View style={styles.contextArea}>
          <Text
            variant="label-sm"
            weight="bold"
            color="primary"
            uppercase
            style={styles.contextLabel}
          >
            Active Context
          </Text>
          <Text variant="headline-md" weight="extrabold" style={styles.contextTitle}>
            Compose Prompt
          </Text>
        </View>

        {/* Requirement 5.2, 5.3: Horizontal scrolling template chips container */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.templateChipsContainer}
          contentContainerStyle={styles.templateChipsContent}
        >
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[styles.templateChip, { backgroundColor: theme.colors.surfaceContainerHigh }]}
              onPress={() => handleSelectTemplate(template)}
              activeOpacity={0.7}
            >
              <Icon name={template.icon} size={16} color={template.iconColor} />
              <Text variant="label-md" weight="medium" style={styles.templateChipLabel}>
                {template.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Requirement 5.3: Main composer container with terminal-like header (colored dots) */}
        <View
          style={[styles.composerContainer, { backgroundColor: theme.colors.surfaceContainerLow }]}
        >
          {/* Terminal-like header with colored dots */}
          <View
            style={[
              styles.terminalHeader,
              { backgroundColor: theme.colors.surfaceContainerLowest },
            ]}
          >
            <View style={styles.terminalDots}>
              <View style={[styles.dot, { backgroundColor: `${theme.colors.error}66` }]} />
              <View style={[styles.dot, { backgroundColor: `${theme.colors.tertiary}66` }]} />
              <View style={[styles.dot, { backgroundColor: `${theme.colors.secondary}66` }]} />
              <Text
                variant="label-sm"
                weight="medium"
                color="onSurfaceVariant"
                uppercase
                style={styles.terminalLabel}
              >
                New Instruction
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={18} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Requirement 5.4, 5.9: Multiline textarea with surfaceContainerLowest background */}
          {/* Requirement 25.1, 25.8: Keyboard handling to keep textarea visible */}
          <View
            style={[
              styles.textareaContainer,
              { backgroundColor: theme.colors.surfaceContainerLowest },
            ]}
          >
            <RNTextInput
              style={[styles.textarea, { color: theme.colors.onSurface }]}
              placeholder="Ask AI to edit your code..."
              placeholderTextColor={`${theme.colors.onSurfaceVariant}66`}
              value={prompt}
              onChangeText={handleTextChange}
              multiline
              textAlignVertical="top"
              editable={!isLoading}
            />

            {/* Requirement 5.6: Bottom toolbar with Clear and Attach buttons */}
            {/* Requirement 5.5, 5.13: Character counter with error state when limit exceeded */}
            <View
              style={[styles.bottomToolbar, { borderTopColor: `${theme.colors.outlineVariant}1A` }]}
            >
              <View style={styles.toolbarButtons}>
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={handleClear}
                  disabled={prompt.length === 0}
                  activeOpacity={0.7}
                >
                  <Icon
                    name="backspace"
                    size={20}
                    color={
                      prompt.length === 0 ? theme.colors.onSurfaceVariant : theme.colors.primary
                    }
                  />
                  <Text
                    variant="label-sm"
                    weight="bold"
                    uppercase
                    color={prompt.length === 0 ? 'onSurfaceVariant' : 'primary'}
                    style={styles.toolbarButtonLabel}
                  >
                    Clear
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={handleAttach}
                  activeOpacity={0.7}
                >
                  <Icon name="attach-file" size={20} color={theme.colors.onSurfaceVariant} />
                  <Text
                    variant="label-sm"
                    weight="bold"
                    uppercase
                    color="onSurfaceVariant"
                    style={styles.toolbarButtonLabel}
                  >
                    Attach
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.charCounter,
                  {
                    backgroundColor: `${theme.colors.surfaceContainerHighest}4D`,
                  },
                  isAtLimit && { backgroundColor: `${theme.colors.errorContainer}4D` },
                ]}
              >
                <Text
                  variant="label-sm"
                  weight="bold"
                  color={isAtLimit ? 'error' : 'onSurfaceVariant'}
                  style={styles.charCounterText}
                >
                  {charCount} / {MAX_CHARS}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Requirement 5.8: Pro tip hint section with lightbulb icon */}
        <View
          style={[
            styles.hintSection,
            {
              backgroundColor: `${theme.colors.primaryContainer}0D`,
              borderColor: `${theme.colors.primaryContainer}1A`,
            },
          ]}
        >
          <Icon name="lightbulb" size={20} color={theme.colors.primary} style={styles.hintIcon} />
          <View style={styles.hintTextContainer}>
            <Text variant="body-sm" color="onSurfaceVariant" style={styles.hintText}>
              <Text variant="body-sm" weight="bold" color="primary">
                Pro Tip:{' '}
              </Text>
              Mention specific functions or file names to help the AI understand the scope of your
              requested changes more accurately.
            </Text>
          </View>
        </View>

        {/* Error display */}
        {error && (
          <View
            style={[
              styles.errorContainer,
              {
                backgroundColor: `${theme.colors.errorContainer}1A`,
                borderColor: `${theme.colors.error}33`,
              },
            ]}
          >
            <Icon name="error" size={20} color={theme.colors.error} />
            <Text variant="body-sm" color="error" style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Requirement 5.7, 5.10: Floating action button (FAB) with send icon */}
      {/* Requirement 12.6: Gradient background (primary to primaryContainer) and scale animation */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            transform: [{ scale: fabScale }],
            opacity: canSubmit ? 1 : 0.5,
          },
        ]}
      >
        <TouchableOpacity
          onPressIn={handleFABPressIn}
          onPressOut={handleFABPressOut}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            {isLoading ? (
              <Icon name="hourglass-empty" size={24} color={theme.colors.onPrimary} fill />
            ) : (
              <Icon name="send" size={24} color={theme.colors.onPrimary} fill />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 80, // Account for TopAppBar
    paddingBottom: 120, // Account for FAB and bottom nav
  },
  contextArea: {
    marginTop: 16,
    marginBottom: 32,
  },
  contextLabel: {
    letterSpacing: 3.2,
    marginBottom: 4,
  },
  contextTitle: {
    letterSpacing: -0.5,
  },
  templateChipsContainer: {
    marginBottom: 24,
    marginHorizontal: -16,
  },
  templateChipsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(64, 71, 79, 0.1)',
  },
  templateChipLabel: {
    fontSize: 12,
  },
  composerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(64, 71, 79, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 20,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(64, 71, 79, 0.1)',
  },
  terminalDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  terminalLabel: {
    marginLeft: 8,
    letterSpacing: 2.4,
  },
  textareaContainer: {
    padding: 24,
  },
  textarea: {
    minHeight: 200,
    fontSize: 18,
    lineHeight: 28,
    fontFamily: 'Inter_400Regular',
  },
  bottomToolbar: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolbarButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarButtonLabel: {
    letterSpacing: 1.4,
  },
  charCounter: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  charCounterText: {
    letterSpacing: 1.6,
  },
  hintSection: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintIcon: {
    marginTop: 2,
  },
  hintTextContainer: {
    flex: 1,
  },
  hintText: {
    lineHeight: 20,
  },
  errorContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 110, // Above bottom nav
    right: 24,
    zIndex: 50,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 20,
  },
});
