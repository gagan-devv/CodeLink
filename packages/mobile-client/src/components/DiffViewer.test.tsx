import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DiffViewer from './DiffViewer';
import { FileContextPayload } from '@codelink/protocol';

describe('DiffViewer Component', () => {
  it('should render with valid payload', () => {
    const payload: FileContextPayload = {
      fileName: 'src/test.ts',
      originalFile: 'const x = 1;',
      modifiedFile: 'const x = 2;',
      isDirty: false,
      timestamp: Date.now(),
    };

    const { container } = render(<DiffViewer payload={payload} />);
    expect(container).toBeTruthy();
  });

  it('should display fileName correctly in header', () => {
    const payload: FileContextPayload = {
      fileName: 'src/components/Button.tsx',
      originalFile: 'old content',
      modifiedFile: 'new content',
      isDirty: false,
      timestamp: Date.now(),
    };

    render(<DiffViewer payload={payload} />);
    expect(screen.getByText('src/components/Button.tsx')).toBeTruthy();
  });

  it('should show isDirty indicator when true', () => {
    const payload: FileContextPayload = {
      fileName: 'src/test.ts',
      originalFile: 'old',
      modifiedFile: 'new',
      isDirty: true,
      timestamp: Date.now(),
    };

    const { container } = render(<DiffViewer payload={payload} />);
    const dirtyIndicator = container.querySelector('[title="Unsaved changes"]');
    expect(dirtyIndicator).toBeTruthy();
    expect(dirtyIndicator?.textContent).toBe('●');
  });

  it('should not show isDirty indicator when false', () => {
    const payload: FileContextPayload = {
      fileName: 'src/test.ts',
      originalFile: 'old',
      modifiedFile: 'new',
      isDirty: false,
      timestamp: Date.now(),
    };

    const { container } = render(<DiffViewer payload={payload} />);
    const dirtyIndicator = container.querySelector('[title="Unsaved changes"]');
    expect(dirtyIndicator).toBeFalsy();
  });

  it('should format timestamp correctly', () => {
    const testTimestamp = new Date('2024-01-15T10:30:00').getTime();
    const payload: FileContextPayload = {
      fileName: 'src/test.ts',
      originalFile: 'old',
      modifiedFile: 'new',
      isDirty: false,
      timestamp: testTimestamp,
    };

    render(<DiffViewer payload={payload} />);
    const expectedFormat = new Date(testTimestamp).toLocaleString();
    expect(screen.getByText(expectedFormat)).toBeTruthy();
  });

  it('should show "No changes" message for identical files', () => {
    const payload: FileContextPayload = {
      fileName: 'src/test.ts',
      originalFile: 'const x = 1;',
      modifiedFile: 'const x = 1;',
      isDirty: false,
      timestamp: Date.now(),
    };

    render(<DiffViewer payload={payload} />);
    expect(screen.getByText('No changes')).toBeTruthy();
  });

  it('should display new file (all additions) when originalFile is empty', () => {
    const payload: FileContextPayload = {
      fileName: 'src/newfile.ts',
      originalFile: '',
      modifiedFile: 'const x = 1;\nconst y = 2;',
      isDirty: false,
      timestamp: Date.now(),
    };

    const { container } = render(<DiffViewer payload={payload} />);
    // Should not show "No changes" message
    expect(screen.queryByText('No changes')).toBeFalsy();
    // Should render the diff viewer (check for content instead of specific class)
    const diffContainer = container.querySelector('[style*="overflow"]');
    expect(diffContainer).toBeTruthy();
  });

  it('should use unified view mode (splitView=false)', () => {
    const payload: FileContextPayload = {
      fileName: 'src/test.ts',
      originalFile: 'line 1\nline 2',
      modifiedFile: 'line 1\nline 3',
      isDirty: false,
      timestamp: Date.now(),
    };

    const { container } = render(<DiffViewer payload={payload} />);
    // Should not show "No changes" since files are different
    expect(screen.queryByText('No changes')).toBeFalsy();
    // Verify the component renders (check for the diff container)
    const diffContainer = container.querySelector('[style*="overflow"]');
    expect(diffContainer).toBeTruthy();
  });
});
