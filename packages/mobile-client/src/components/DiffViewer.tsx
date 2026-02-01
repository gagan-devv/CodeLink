import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { FileContextPayload } from '@codelink/protocol';

/**
 * DiffViewer component props
 */
export interface DiffViewerProps {
  payload: FileContextPayload;
  isLoading?: boolean;
  onBack?: () => void;
}

/**
 * Represents a single line in the diff
 */
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * DiffViewer component displays unified file diffs in React Native
 * Supports both portrait and landscape orientations with responsive layout
 * 
 * Requirements: 6.1, 7.2, 7.4, 7.5, 10.1, 10.2
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  payload,
  isLoading = false,
  onBack
}) => {
  const { fileName, originalFile, modifiedFile } = payload;
  const [isRendering, setIsRendering] = useState(true);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Check if this is a new file (no original content)
  const isNewFile = originalFile === '';

  // Check if there are no changes
  const noChanges = originalFile === modifiedFile;

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
            type: 'added',
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
              type: 'added',
              lineNumber: i + 1,
              content: newLines[i],
              newLineNumber: newLineNum++,
            });
          } else if (i >= newLines.length) {
            // Deletion
            diff.push({
              type: 'removed',
              lineNumber: i + 1,
              content: oldLines[i],
              oldLineNumber: oldLineNum++,
            });
          } else if (oldLines[i] !== newLines[i]) {
            // Changed line - show as removal then addition
            diff.push({
              type: 'removed',
              lineNumber: i + 1,
              content: oldLines[i],
              oldLineNumber: oldLineNum++,
            });
            diff.push({
              type: 'added',
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
   * Handle loading state transition
   */
  useEffect(() => {
    setIsRendering(true);
    const timer = setTimeout(() => setIsRendering(false), 100);
    return () => clearTimeout(timer);
  }, [payload]);

  /**
   * Render a single diff line with syntax highlighting
   */
  const renderLine = (line: DiffLine, index: number) => {
    const lineStyle = [
      styles.lineContainer,
      line.type === 'added' && styles.addedLine,
      line.type === 'removed' && styles.removedLine,
    ];

    return (
      <View key={index} style={lineStyle}>
        {/* Line numbers */}
        <View style={styles.lineNumbers}>
          <Text style={styles.lineNumber}>
            {line.oldLineNumber || ''}
          </Text>
          <Text style={[styles.lineNumber, styles.lineNumberRight]}>
            {line.newLineNumber || ''}
          </Text>
        </View>
        
        {/* Diff indicator */}
        <View style={styles.diffIndicator}>
          {line.type === 'added' && (
            <Text style={styles.addedIndicator}>+</Text>
          )}
          {line.type === 'removed' && (
            <Text style={styles.removedIndicator}>-</Text>
          )}
        </View>
        
        {/* Code content */}
        <Text style={styles.lineContent}>
          {line.content || ' '}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {onBack && (
              <Text style={styles.backButton} onPress={onBack}>
                ← Back
              </Text>
            )}
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
            </View>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.additionsBadge}>
              <Text style={styles.additionsText}>+{stats.additions}</Text>
            </View>
            <View style={styles.deletionsBadge}>
              <Text style={styles.deletionsText}>-{stats.deletions}</Text>
            </View>
          </View>
        </View>

        {/* File Path */}
        {getFilePath() && (
          <View style={styles.filePathContainer}>
            <Text style={styles.filePath} numberOfLines={1}>
              {getFilePath()}
            </Text>
          </View>
        )}
      </View>

      {/* Diff Content with horizontal and vertical scrolling */}
      <View style={styles.diffContainer}>
        {noChanges && !isNewFile ? (
          <View style={styles.noChangesContainer}>
            <Text style={styles.noChangesIcon}>✓</Text>
            <Text style={styles.noChangesText}>No changes</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            contentContainerStyle={styles.horizontalScrollContent}
          >
            <ScrollView
              style={styles.verticalScroll}
              contentContainerStyle={styles.verticalScrollContent}
            >
              {diffLines.map(renderLine)}
            </ScrollView>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  containerLandscape: {
    // Landscape-specific adjustments handled by ScrollView
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    color: '#9ca3af',
    fontSize: 16,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  fileName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  additionsBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  additionsText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  deletionsBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deletionsText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
  },
  filePathContainer: {
    marginTop: 8,
  },
  filePath: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  diffContainer: {
    flex: 1,
  },
  noChangesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noChangesIcon: {
    fontSize: 48,
    color: '#6b7280',
    marginBottom: 16,
  },
  noChangesText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  horizontalScrollContent: {
    minWidth: '100%',
  },
  verticalScroll: {
    flex: 1,
  },
  verticalScrollContent: {
    paddingBottom: 16,
  },
  lineContainer: {
    flexDirection: 'row',
    minHeight: 24,
    paddingVertical: 2,
  },
  addedLine: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  removedLine: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  lineNumbers: {
    flexDirection: 'row',
    minWidth: 96,
  },
  lineNumber: {
    width: 48,
    textAlign: 'right',
    paddingHorizontal: 8,
    color: '#6b7280',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  lineNumberRight: {
    borderRightWidth: 1,
    borderRightColor: '#30363d',
  },
  diffIndicator: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addedIndicator: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  removedIndicator: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  lineContent: {
    flex: 1,
    paddingHorizontal: 8,
    color: '#d1d5db',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default DiffViewer;
