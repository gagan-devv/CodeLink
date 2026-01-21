import { useState, useEffect } from 'react';
import { FileContextPayload } from '@codelink/protocol';

interface DiffViewerProps {
  payload: FileContextPayload;
  isLoading?: boolean;
  onBack?: () => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function DiffViewer({ payload, isLoading = false, onBack }: DiffViewerProps) {
  const { fileName, originalFile, modifiedFile } = payload;
  const [isRendering, setIsRendering] = useState(true);

  // Check if this is a new file (no original content)
  const isNewFile = originalFile === '';

  // Check if there are no changes
  const noChanges = originalFile === modifiedFile;

  // Calculate additions and deletions
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

  // Generate simple line-by-line diff
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

  const diffLines = generateDiff();

  // Get file path parts
  const getFilePath = () => {
    const parts = fileName.split('/');
    return parts.slice(0, -1).join(' / ');
  };

  // Handle loading state transition
  useEffect(() => {
    setIsRendering(true);
    const timer = setTimeout(() => setIsRendering(false), 100);
    return () => clearTimeout(timer);
  }, [payload]);

  const handleComment = () => {
    console.log('Comment button clicked');
    alert('Comment functionality not yet implemented');
  };

  const handleApprove = () => {
    console.log('Approve button clicked');
    alert('Approve functionality not yet implemented');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#0d1117]">
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{fileName}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded">
              +{stats.additions}
            </div>
            <div className="px-2 py-1 bg-red-600/20 text-red-400 text-xs font-semibold rounded">
              -{stats.deletions}
            </div>
            <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* File Path */}
        {getFilePath() && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="font-mono">{getFilePath()}</span>
          </div>
        )}
      </div>

      {/* Diff Content */}
      <div className={`flex-1 overflow-auto ${isRendering ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
        {noChanges && !isNewFile ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="text-gray-400 text-sm">No changes</div>
            </div>
          </div>
        ) : (
          <div className="font-mono text-sm">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-green-900/30'
                    : line.type === 'removed'
                    ? 'bg-red-900/30'
                    : 'bg-transparent'
                }`}
              >
                {/* Line numbers */}
                <div className="flex-shrink-0 flex">
                  <div className="w-12 text-right px-2 py-1 text-gray-600 select-none">
                    {line.oldLineNumber || ''}
                  </div>
                  <div className="w-12 text-right px-2 py-1 text-gray-600 select-none border-r border-gray-800">
                    {line.newLineNumber || ''}
                  </div>
                </div>
                
                {/* Diff indicator */}
                <div className="w-8 flex-shrink-0 flex items-center justify-center text-gray-500">
                  {line.type === 'added' ? (
                    <span className="text-green-400">+</span>
                  ) : line.type === 'removed' ? (
                    <span className="text-red-400">-</span>
                  ) : (
                    ''
                  )}
                </div>
                
                {/* Code content */}
                <div className="flex-1 px-2 py-1 text-gray-300 overflow-x-auto whitespace-pre">
                  {line.content || ' '}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-[#161b22] border-t border-gray-800 p-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleComment}
            className="bg-[#21262d] hover:bg-[#2d333b] text-gray-300 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-gray-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            Comment
          </button>
          <button
            onClick={handleApprove}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiffViewer;
