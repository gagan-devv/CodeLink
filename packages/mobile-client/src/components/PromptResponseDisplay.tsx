import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { InjectPromptResponse } from '@codelink/protocol';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { useDesignSystem } from '../design-system';
import { Text } from '../design-system/typography/Text';
import { Card } from '../design-system/components/Card';
import { Icon } from '../design-system/components/Icon';
import { TopAppBar } from '../navigation/TopAppBar';

/**
 * PromptResponseDisplay component props
 */
export interface PromptResponseDisplayProps {
  response: InjectPromptResponse | null;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
}

/**
 * PromptResponseDisplay component - Redesigned with Obsidian UI aesthetic
 * Features success/error feedback cards, detail grid, AI response snippet, and troubleshooting hints
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12
 * Requirements: 21.2 (Syntax highlighting in code preview)
 * Requirements: 18 (Material Symbols icons)
 */
export const PromptResponseDisplay: React.FC<PromptResponseDisplayProps> = ({
  response,
  connectionStatus = 'connected',
}) => {
  const { theme } = useDesignSystem();

  if (!response) {
    return null;
  }

  const { success, error, editorUsed } = response.payload;
  const timestamp = new Date();

  /**
   * Create custom syntax highlighting theme matching design system
   * Requirements: 21.2
   */
  const customTheme = {
    'hljs-keyword': { color: theme.colors.primaryContainer },
    'hljs-string': { color: theme.colors.secondary },
    'hljs-number': { color: theme.colors.tertiary },
    'hljs-comment': { color: theme.colors.onSurfaceVariant },
    'hljs-function': { color: theme.colors.primary },
    'hljs-variable': { color: theme.colors.onSurface },
  };

  // Sample code snippet for demonstration
  const codeSnippet = `function processPrompt(input: string) {
  // AI is processing your request
  return analyzeAndExecute(input);
}`;

  return (
    <View style={styles.container}>
      {/* Requirement 6.1: TopAppBar */}
      <TopAppBar connectionStatus={connectionStatus} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Requirement 6.1, 6.11, 6.12: Success/Error feedback card */}
        <Card
          variant="low"
          padding="lg"
          borderRadius="xl"
          style={[
            styles.feedbackCard,
            {
              backgroundColor: success
                ? `${theme.colors.secondary}1A` // secondary/10 for success
                : `${theme.colors.errorContainer}1A`,
            },
          ]}
        >
          <View style={styles.feedbackContent}>
            <Icon
              name={success ? 'check-circle' : 'error'}
              size={24}
              color={success ? 'secondary' : 'error'}
            />
            <View style={styles.feedbackTextContainer}>
              <Text variant="title-md" weight="bold" color={success ? 'secondary' : 'error'}>
                {success ? 'Success: Prompt Sent' : 'Error: Prompt Failed'}
              </Text>
              {error && (
                <Text variant="body-sm" color="error" style={styles.errorMessage}>
                  {error}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Requirement 6.2, 6.3, 6.8: Asymmetrical detail grid (3-column + 2-column) */}
        <View style={styles.detailGrid}>
          {/* 3-column section: Target AI Editor */}
          <Card
            variant="low"
            padding="lg"
            borderRadius="xl"
            style={[styles.detailCard, styles.col3]}
          >
            <Text
              variant="label-sm"
              weight="bold"
              color="onSurfaceVariant"
              uppercase
              style={styles.detailLabel}
            >
              Target AI Editor
            </Text>
            <Text variant="body-md" weight="medium" color="onSurface" style={styles.detailValue}>
              {editorUsed || 'VS Code'}
            </Text>
          </Card>

          {/* 2-column section: Timestamp */}
          <Card
            variant="low"
            padding="lg"
            borderRadius="xl"
            style={[styles.detailCard, styles.col2]}
          >
            <View style={styles.timestampContent}>
              <Icon name="schedule" size={16} color="onSurfaceVariant" />
              <View style={styles.timestampText}>
                <Text
                  variant="label-sm"
                  weight="bold"
                  color="onSurfaceVariant"
                  uppercase
                  style={styles.detailLabel}
                >
                  Timestamp
                </Text>
                <Text variant="body-sm" weight="medium" color="onSurface">
                  {timestamp.toLocaleTimeString()}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Requirement 6.4, 6.5, 6.10: AI response snippet with terminal-like header and code preview */}
        <Card variant="low" padding="xs" borderRadius="xl" style={styles.responseCard}>
          {/* Terminal-like header */}
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
                AI Response Snippet
              </Text>
            </View>
          </View>

          {/* Requirement 6.5, 6.10: Code preview with syntax highlighting */}
          <View
            style={[styles.codePreview, { backgroundColor: theme.colors.surfaceContainerLowest }]}
          >
            <SyntaxHighlighter
              language="typescript"
              style={customTheme}
              customStyle={{
                backgroundColor: 'transparent',
                fontFamily: theme.typography.fonts.mono,
                fontSize: 14,
                lineHeight: 20,
                margin: 0,
                padding: 0,
              }}
              showLineNumbers={true}
              lineNumberStyle={{
                color: theme.colors.onSurfaceVariant,
                opacity: 0.5,
                paddingRight: 16,
                minWidth: 40,
              }}
            >
              {codeSnippet}
            </SyntaxHighlighter>
          </View>
        </Card>

        {/* Requirement 6.6: Processing status message */}
        <Card variant="low" padding="lg" borderRadius="xl" style={styles.statusCard}>
          <View style={styles.statusContent}>
            <Icon name="hourglass-empty" size={20} color="primary" />
            <Text variant="body-md" color="onSurface" style={styles.statusText}>
              AI agent is processing your request...
            </Text>
          </View>
        </Card>

        {/* Requirement 6.7: Troubleshooting hint footer with help icon */}
        <View
          style={[
            styles.hintSection,
            {
              backgroundColor: `${theme.colors.primaryContainer}0D`,
              borderColor: `${theme.colors.primaryContainer}1A`,
            },
          ]}
        >
          <Icon name="help" size={20} color="primary" style={styles.hintIcon} />
          <View style={styles.hintTextContainer}>
            <Text variant="body-sm" color="onSurfaceVariant" style={styles.hintText}>
              <Text variant="body-sm" weight="bold" color="primary">
                Troubleshooting:{' '}
              </Text>
              If your prompt doesn't appear in the editor, check your connection status and ensure
              the relay server is running.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: 120, // Account for bottom nav
  },
  feedbackCard: {
    marginBottom: 24,
  },
  feedbackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  feedbackTextContainer: {
    flex: 1,
  },
  errorMessage: {
    marginTop: 4,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  detailCard: {
    minHeight: 80,
  },
  col3: {
    flex: 3,
  },
  col2: {
    flex: 2,
  },
  detailLabel: {
    letterSpacing: 2.4,
    marginBottom: 8,
  },
  detailValue: {
    lineHeight: 24,
  },
  timestampContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timestampText: {
    flex: 1,
  },
  responseCard: {
    marginBottom: 24,
    overflow: 'hidden',
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
  codePreview: {
    padding: 16,
  },
  statusCard: {
    marginBottom: 24,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    flex: 1,
    lineHeight: 20,
  },
  hintSection: {
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
});
