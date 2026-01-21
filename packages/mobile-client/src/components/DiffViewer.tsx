import { FileContextPayload } from '@codelink/protocol';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface DiffViewerProps {
  payload: FileContextPayload;
}

function DiffViewer({ payload }: DiffViewerProps) {
  const { fileName, originalFile, modifiedFile, isDirty, timestamp } = payload;

  // Check if this is a new file (no original content)
  const isNewFile = originalFile === '';

  // Check if there are no changes
  const noChanges = originalFile === modifiedFile;

  // Format timestamp
  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleString();
  };

  return (
    <div style={styles.container}>
      {/* Diff Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <span style={styles.fileName}>{fileName}</span>
          {isDirty && (
            <span style={styles.dirtyIndicator} title="Unsaved changes">
              ●
            </span>
          )}
        </div>
        <div style={styles.timestamp}>{formatTimestamp(timestamp)}</div>
      </div>

      {/* Diff Content */}
      <div style={styles.diffContainer}>
        {noChanges && !isNewFile ? (
          <div style={styles.noChanges}>No changes</div>
        ) : (
          <ReactDiffViewer
            oldValue={originalFile}
            newValue={modifiedFile}
            splitView={false}
            useDarkTheme={true}
            styles={{
              variables: {
                light: {
                  diffViewerBackground: '#1e1e1e',
                  diffViewerColor: '#d4d4d4',
                  addedBackground: '#044B53',
                  addedColor: '#d4d4d4',
                  removedBackground: '#5A1E1E',
                  removedColor: '#d4d4d4',
                  wordAddedBackground: '#055d67',
                  wordRemovedBackground: '#7a2626',
                  addedGutterBackground: '#033b42',
                  removedGutterBackground: '#4a1616',
                  gutterBackground: '#1e1e1e',
                  gutterBackgroundDark: '#1e1e1e',
                  highlightBackground: '#2a2a2a',
                  highlightGutterBackground: '#2a2a2a',
                },
              },
              line: {
                fontSize: '12px',
                lineHeight: '1.5',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              },
              gutter: {
                fontSize: '12px',
                lineHeight: '1.5',
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#1e1e1e',
  },
  header: {
    padding: '12px 16px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3e3e42',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '600' as const,
    color: '#cccccc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  dirtyIndicator: {
    fontSize: '16px',
    color: '#ff9800',
    lineHeight: '1',
  },
  timestamp: {
    fontSize: '11px',
    color: '#858585',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  diffContainer: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#1e1e1e',
  },
  noChanges: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#858585',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
};

export default DiffViewer;
