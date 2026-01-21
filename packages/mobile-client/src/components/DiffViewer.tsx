import { useState, useEffect } from 'react';
import { FileContextPayload } from '@codelink/protocol';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface DiffViewerProps {
  payload: FileContextPayload;
  isLoading?: boolean;
}

function DiffViewer({ payload, isLoading = false }: DiffViewerProps) {
  const { fileName, originalFile, modifiedFile, isDirty, timestamp } = payload;
  const [isRendering, setIsRendering] = useState(true);

  // Check if this is a new file (no original content)
  const isNewFile = originalFile === '';

  // Check if there are no changes
  const noChanges = originalFile === modifiedFile;

  // Format timestamp
  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle loading state transition
  useEffect(() => {
    setIsRendering(true);
    const timer = setTimeout(() => setIsRendering(false), 100);
    return () => clearTimeout(timer);
  }, [payload]);

  if (isLoading) {
    return (
      <div className="diff-viewer-container">
        <div className="diff-loading">
          <div className="diff-loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="diff-viewer-container diff-fade-in">
      {/* Diff Header */}
      <div className="diff-header">
        <div className="diff-header-top">
          <span className="diff-file-name">{fileName}</span>
          {isDirty && (
            <span className="diff-dirty-indicator" title="Unsaved changes">
              ●
            </span>
          )}
        </div>
        <div className="diff-timestamp">{formatTimestamp(timestamp)}</div>
      </div>

      {/* Diff Content */}
      <div className={`diff-content-wrapper ${isRendering ? 'opacity-0' : 'opacity-100'}`}>
        {noChanges && !isNewFile ? (
          <div className="diff-no-changes">No changes</div>
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

export default DiffViewer;
