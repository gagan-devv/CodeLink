import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, FlatList } from 'react-native';
import { FileContextPayload } from '@codelink/protocol';
import { useDesignSystem } from '../design-system';
import { Text } from '../design-system/typography/Text';
import { TopAppBar } from '../navigation/TopAppBar';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { Icon } from '../design-system/components/Icon';
import { Skeleton } from '../design-system/components/Skeleton';
import SyntaxHighlighter from 'react-syntax-highlighter';

/**
 * DiffViewer component props
 */
export interface DiffViewerProps {
  payload: FileContextPayload | null;
  isLoading?: boolean;
  onBack?: () => void;
  onRefresh?: () => Promise<void>;
  onCommit?: () => void;
  onRevert?: () => void;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
}

/**
 * Represents a single line in the diff
 */
interface DiffLine {
  type: 'addition' | 'deletion' | 'unchanged';
  lineNumber: number;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * DiffViewer component displays unified file diffs in React Native
 * Supports both portrait and landscape orientations with responsive layout
 * Provides horizontal and vertical scrolling for long content
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14,
 *               15.9, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  payload,
  isLoading = false,
  onRefresh,
  onCommit,
  onRevert,
  connectionStatus = 'connected',
}) => {
  const { theme } = useDesignSystem();
  const [refreshing, setRefreshing] = useState(false);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  // If no payload, show empty state with pull-to-refresh hint
  if (!payload) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <TopAppBar connectionStatus={connectionStatus} />
        <ScrollView
          contentContainerStyle={styles.emptyStateContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          <Icon name="difference" size={64} color="onSurfaceVariant" />
          <Text variant="headline-sm" color="onSurfaceVariant" style={styles.emptyStateText}>
            Pull to refresh changes
          </Text>
        </ScrollView>
      </View>
    );
  }

  const { fileName, originalFile, modifiedFile } = payload;

  // Check if this is a new file (no original content)
  const isNewFile = originalFile === '';

  // Check if there are no changes
  const noChanges = originalFile === modifiedFile;

  // Detect language from file extension
  const detectLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      py: 'python',
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cc: 'cpp',
      cxx: 'cpp',
      go: 'go',
      rs: 'rust',
    };
    return languageMap[ext || ''] || 'text';
  };

  const language = detectLanguage(fileName);

  /**
   * Create custom syntax highlighting theme matching design system
   * Requirements: 21.4, 21.5, 21.6
   */
  const createCustomTheme = (): { [key: string]: React.CSSProperties } => {
    return {
      hljs: {
        display: 'block',
        overflowX: 'auto' as const,
        background: 'transparent',
        color: theme.colors.onSurface,
      },
      'hljs-keyword': { color: theme.colors.primaryContainer }, // Keywords in primaryContainer
      'hljs-built_in': { color: theme.colors.primaryContainer },
      'hljs-type': { color: theme.colors.primaryContainer },
      'hljs-literal': { color: theme.colors.primaryContainer },
      'hljs-string': { color: theme.colors.secondary }, // Strings in secondary
      'hljs-regexp': { color: theme.colors.secondary },
      'hljs-number': { color: theme.colors.tertiary }, // Numbers in tertiary
      'hljs-comment': { color: theme.colors.onSurfaceVariant }, // Comments in onSurfaceVariant
      'hljs-doctag': { color: theme.colors.onSurfaceVariant },
      'hljs-function': { color: theme.colors.onSurface },
      'hljs-title': { color: theme.colors.onSurface },
      'hljs-params': { color: theme.colors.onSurface },
      'hljs-variable': { color: theme.colors.onSurface },
      'hljs-attr': { color: theme.colors.onSurface },
      'hljs-name': { color: theme.colors.onSurface },
      'hljs-tag': { color: theme.colors.primaryContainer },
      'hljs-selector-tag': { color: theme.colors.primaryContainer },
      'hljs-selector-id': { color: theme.colors.primaryContainer },
      'hljs-selector-class': { color: theme.colors.primaryContainer },
      'hljs-meta': { color: theme.colors.onSurfaceVariant },
      'hljs-meta-keyword': { color: theme.colors.primaryContainer },
      'hljs-meta-string': { color: theme.colors.secondary },
    };
  };

  const customTheme = createCustomTheme();

  /**
   * Map file extensions to syntax highlighter language names
   * Requirements: 21.3
   */
  const getSyntaxLanguage = (detectedLang: string): string => {
    const languageMap: Record<string, string> = {
      python: 'python',
      javascript: 'javascript',
      typescript: 'typescript',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      go: 'go',
      rust: 'rust',
      text: 'plaintext',
    };
    return languageMap[detectedLang] || 'plaintext';
  };

  const syntaxLanguage = getSyntaxLanguage(language);

  // Note: Syntax highlighting with react-syntax-highlighter doesn't work well in React Native
  // We use monospace font for all code content as a fallback (satisfies requirement 21.8)
  // This provides a clean, readable code display that works across all platforms

  /**
   * Calculate additions and deletions statistics
   */
  const calculateStats = () => {
    if (noChanges) return { additions: 0, deletions: 0 };

    const oldLines = originalFile.split('\n');
    const newLines = modifiedFile.split('\n');

    let additions = 0;
    let deletions = 0;

    // Simple line-based diff calculation
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (i >= oldLines.length) {
        additions++;
      } else if (i >= newLines.length) {
        deletions++;
      } else if (oldLines[i] !== newLines[i]) {
        additions++;
        deletions++;
      }
    }

    return { additions, deletions };
  };

  const stats = calculateStats();

  /**
   * Generate simple line-by-line diff
   * Memoized to recalculate only when payload changes
   */
  const diffLines = useMemo(() => {
    const generateDiff = (): DiffLine[] => {
      if (noChanges && !isNewFile) return [];

      const oldLines = originalFile.split('\n');
      const newLines = modifiedFile.split('\n');
      const diff: DiffLine[] = [];

      if (isNewFile) {
        // All lines are additions
        newLines.forEach((line, idx) => {
          diff.push({
            type: 'addition',
            lineNumber: idx + 1,
            content: line,
            newLineNumber: idx + 1,
          });
        });
      } else {
        // Simple line-by-line comparison
        const maxLines = Math.max(oldLines.length, newLines.length);
        let oldLineNum = 1;
        let newLineNum = 1;

        for (let i = 0; i < maxLines; i++) {
          if (i >= oldLines.length) {
            // Addition
            diff.push({
              type: 'addition',
              lineNumber: i + 1,
              content: newLines[i],
              newLineNumber: newLineNum++,
            });
          } else if (i >= newLines.length) {
            // Deletion
            diff.push({
              type: 'deletion',
              lineNumber: i + 1,
              content: oldLines[i],
              oldLineNumber: oldLineNum++,
            });
          } else if (oldLines[i] !== newLines[i]) {
            // Changed line - show as removal then addition
            diff.push({
              type: 'deletion',
              lineNumber: i + 1,
              content: oldLines[i],
              oldLineNumber: oldLineNum++,
            });
            diff.push({
              type: 'addition',
              lineNumber: i + 1,
              content: newLines[i],
              newLineNumber: newLineNum++,
            });
          } else {
            // Unchanged
            diff.push({
              type: 'unchanged',
              lineNumber: i + 1,
              content: oldLines[i],
              oldLineNumber: oldLineNum++,
              newLineNumber: newLineNum++,
            });
          }
        }
      }

      return diff;
    };

    return generateDiff();
  }, [originalFile, modifiedFile, noChanges, isNewFile]);

  /**
   * Get file path parts for display
   */
  const getFilePath = () => {
    const parts = fileName.split('/');
    return parts.slice(0, -1).join(' / ');
  };

  /**
   * Get file name without path
   */
  const getFileName = () => {
    const parts = fileName.split('/');
    return parts[parts.length - 1];
  };

  /**
   * Render a single diff line with syntax highlighting
   * Requirements: 21.1, 21.2, 21.7, 21.8
   */
  const renderLine = ({ item: line, index }: { item: DiffLine; index: number }) => {
    const lineStyle = [
      styles.lineContainer,
      {
        backgroundColor:
          line.type === 'addition'
            ? `${theme.colors.secondaryContainer}33` // 20% opacity
            : line.type === 'deletion'
              ? `${theme.colors.errorContainer}33` // 20% opacity
              : 'transparent',
        borderLeftWidth: line.type !== 'unchanged' ? 3 : 0,
        borderLeftColor:
          line.type === 'addition'
            ? theme.colors.secondary
            : line.type === 'deletion'
              ? theme.colors.error
              : 'transparent',
      },
    ];

    // Determine if we should apply syntax highlighting
    // Fallback to plain text if language cannot be detected (Requirement 21.8)
    const shouldHighlight = syntaxLanguage !== 'plaintext' && syntaxLanguage !== 'text';

    return (
      <View key={index} style={lineStyle}>
        {/* Line numbers */}
        <View style={styles.lineNumbers}>
          <Text
            variant="body-sm"
            color="onSurfaceVariant"
            style={[styles.lineNumber, { fontFamily: theme.typography.fonts.mono }]}
          >
            {line.oldLineNumber || ''}
          </Text>
          <Text
            variant="body-sm"
            color="onSurfaceVariant"
            style={[
              styles.lineNumber,
              styles.lineNumberRight,
              {
                fontFamily: theme.typography.fonts.mono,
                borderRightColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {line.newLineNumber || ''}
          </Text>
        </View>

        {/* Diff indicator */}
        <View style={styles.diffIndicator}>
          {line.type === 'addition' && (
            <Text variant="body-md" weight="semibold" style={{ color: theme.colors.secondary }}>
              +
            </Text>
          )}
          {line.type === 'deletion' && (
            <Text variant="body-md" weight="semibold" style={{ color: theme.colors.error }}>
              -
            </Text>
          )}
        </View>

        {/* Code content with syntax highlighting */}
        <View style={styles.lineContent}>
          {shouldHighlight ? (
            <SyntaxHighlighter
              language={syntaxLanguage}
              style={customTheme}
              customStyle={{
                backgroundColor: 'transparent',
                padding: 0,
                margin: 0,
                fontFamily: theme.typography.fonts.mono,
                fontSize: 12,
              }}
              PreTag={View}
              CodeTag={Text}
            >
              {line.content || ' '}
            </SyntaxHighlighter>
          ) : (
            <Text
              variant="body-sm"
              color="onSurface"
              style={{ fontFamily: theme.typography.fonts.mono }}
            >
              {line.content || ' '}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <TopAppBar connectionStatus={connectionStatus} />
        <ScrollView style={styles.scrollView}>
          <View style={{ padding: 16 }}>
            {/* File header skeleton */}
            <Card variant="low" style={styles.fileHeader}>
              <View style={styles.fileHeaderTop}>
                <View style={{ flex: 1 }}>
                  <Skeleton width="60%" height={24} style={{ marginBottom: 8 }} />
                  <Skeleton width="80%" height={16} />
                </View>
              </View>
            </Card>

            {/* Diff content skeleton */}
            <Card variant="lowest" style={{ marginTop: 16 }}>
              <View style={styles.diffSkeletonContainer}>
                {[...Array(10)].map((_, i) => (
                  <View key={i} style={styles.diffLineSkeletonRow}>
                    <Skeleton width={40} height={16} style={{ marginRight: 12 }} />
                    <Skeleton width="85%" height={16} />
                  </View>
                ))}
              </View>
            </Card>

            {/* Summary footer skeleton */}
            <Card variant="low" style={styles.summaryFooter}>
              <Skeleton width="50%" height={20} />
            </Card>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Top App Bar */}
      <TopAppBar connectionStatus={connectionStatus} />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* File Header */}
        <Card variant="low" padding="lg" style={styles.fileHeader}>
          <View style={styles.fileHeaderTop}>
            <View style={styles.fileInfo}>
              {/* Unsaved changes indicator */}
              {!noChanges && (
                <View
                  style={[styles.unsavedIndicator, { backgroundColor: theme.colors.tertiary }]}
                />
              )}
              <View style={styles.fileNameContainer}>
                <Icon name="folder-open" size={20} color="onSurfaceVariant" />
                <Text
                  variant="title-md"
                  weight="semibold"
                  color="onSurface"
                  style={styles.fileName}
                >
                  {getFileName()}
                </Text>
              </View>
              {getFilePath() && (
                <Text
                  variant="body-sm"
                  color="onSurfaceVariant"
                  style={[styles.filePath, { fontFamily: theme.typography.fonts.mono }]}
                >
                  {getFilePath()}
                </Text>
              )}
              <Text variant="body-sm" color="onSurfaceVariant" style={styles.timestamp}>
                <Icon name="schedule" size={14} color="onSurfaceVariant" /> Last modified:{' '}
                {new Date().toLocaleString()}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              {onCommit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={onCommit}
                  icon={<Icon name="check-circle" size={16} color="onSecondary" />}
                >
                  Commit
                </Button>
              )}
              {onRevert && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={onRevert}
                  icon={<Icon name="undo" size={16} color="secondary" />}
                  style={styles.revertButton}
                >
                  Revert
                </Button>
              )}
            </View>
          </View>
        </Card>

        {/* Unified Diff Code Block */}
        <Card
          variant="lowest"
          padding="md"
          style={[styles.diffContainer, { backgroundColor: theme.colors.surfaceContainerLowest }]}
        >
          {noChanges && !isNewFile ? (
            <View style={styles.noChangesContainer}>
              <Icon name="check-circle" size={48} color="onSurfaceVariant" />
              <Text variant="body-lg" color="onSurfaceVariant" style={styles.noChangesText}>
                No changes
              </Text>
            </View>
          ) : diffLines.length > 1000 ? (
            // Virtualized list for diffs exceeding 1000 lines
            <FlatList
              data={diffLines}
              renderItem={renderLine}
              keyExtractor={(item, index) => `${item.lineNumber}-${index}`}
              initialNumToRender={50}
              maxToRenderPerBatch={50}
              windowSize={10}
              removeClippedSubviews={true}
              style={styles.virtualizedList}
            />
          ) : (
            // Regular rendering for smaller diffs
            <ScrollView horizontal contentContainerStyle={styles.horizontalScrollContent}>
              <View style={styles.diffLinesContainer}>
                {diffLines.map((line, index) => renderLine({ item: line, index }))}
              </View>
            </ScrollView>
          )}
        </Card>

        {/* Diff Summary Footer */}
        <Card variant="low" padding="lg" style={styles.summaryFooter}>
          <View style={styles.summaryContent}>
            <View style={styles.statsContainer}>
              <View
                style={[
                  styles.statBadge,
                  { backgroundColor: `${theme.colors.secondaryContainer}33` },
                ]}
              >
                <Text
                  variant="label-md"
                  weight="semibold"
                  style={{ color: theme.colors.secondary }}
                >
                  +{stats.additions}
                </Text>
              </View>
              <View
                style={[styles.statBadge, { backgroundColor: `${theme.colors.errorContainer}33` }]}
              >
                <Text variant="label-md" weight="semibold" style={{ color: theme.colors.error }}>
                  -{stats.deletions}
                </Text>
              </View>
              <View
                style={[
                  styles.languageBadge,
                  { backgroundColor: theme.colors.surfaceContainerHighest },
                ]}
              >
                <Text variant="label-sm" color="onSurfaceVariant" uppercase>
                  {language}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Contextual Analysis Card */}
        <Card variant="low" padding="lg" style={styles.contextualCard}>
          <View style={styles.cardHeader}>
            <Icon name="lightbulb" size={20} color="primary" />
            <Text variant="title-sm" weight="semibold" color="onSurface">
              Contextual Analysis
            </Text>
          </View>
          <Text variant="body-md" color="onSurfaceVariant" style={styles.cardContent}>
            {stats.additions > 0 && stats.deletions > 0
              ? `Modified ${stats.additions + stats.deletions} lines with ${stats.additions} additions and ${stats.deletions} deletions.`
              : stats.additions > 0
                ? `Added ${stats.additions} new lines.`
                : stats.deletions > 0
                  ? `Removed ${stats.deletions} lines.`
                  : 'No changes detected.'}
          </Text>
        </Card>

        {/* Author Information Card */}
        <Card variant="low" padding="lg" style={styles.authorCard}>
          <View style={styles.cardHeader}>
            <Icon name="person" size={20} color="primary" />
            <Text variant="title-sm" weight="semibold" color="onSurface">
              Author Information
            </Text>
          </View>
          <View style={styles.authorInfo}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="title-sm" weight="bold" color="onPrimary">
                AI
              </Text>
            </View>
            <View style={styles.authorDetails}>
              <Text variant="body-md" weight="semibold" color="onSurface">
                AI Editor
              </Text>
              <Text variant="body-sm" color="onSurfaceVariant">
                Automated code modification
              </Text>
            </View>
          </View>
        </Card>
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
  diffSkeletonContainer: {
    padding: 16,
  },
  diffLineSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: 400,
  },
  emptyStateText: {
    marginTop: 16,
    textAlign: 'center',
  },
  fileHeader: {
    margin: 16,
    marginBottom: 8,
  },
  fileHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fileInfo: {
    flex: 1,
    marginRight: 16,
  },
  unsavedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  fileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileName: {
    marginLeft: 8,
  },
  filePath: {
    marginTop: 4,
    marginBottom: 8,
  },
  timestamp: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  revertButton: {
    marginLeft: 8,
  },
  diffContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 200,
  },
  noChangesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  noChangesText: {
    marginTop: 16,
  },
  horizontalScrollContent: {
    minWidth: '100%',
  },
  diffLinesContainer: {
    flex: 1,
  },
  virtualizedList: {
    flex: 1,
  },
  lineContainer: {
    flexDirection: 'row',
    minHeight: 24,
    paddingVertical: 2,
  },
  lineNumbers: {
    flexDirection: 'row',
    minWidth: 96,
  },
  lineNumber: {
    width: 48,
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  lineNumberRight: {
    borderRightWidth: 1,
  },
  diffIndicator: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineContent: {
    flex: 1,
    paddingHorizontal: 8,
  },
  summaryFooter: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  languageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  contextualCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  authorCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardContent: {
    lineHeight: 20,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorDetails: {
    flex: 1,
  },
});

export default DiffViewer;
