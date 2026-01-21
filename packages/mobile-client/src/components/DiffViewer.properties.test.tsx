import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import DiffViewer from './DiffViewer';
import { FileContextPayload } from '@codelink/protocol';

// Feature: git-integration-diffing, Property 17: Diff rendering
describe('DiffViewer Property Tests', () => {
  it('Property 17: Diff rendering - should render any valid FileContextPayload without crashing', () => {
    fc.assert(
      fc.property(
        fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 100 }),
          originalFile: fc.string({ maxLength: 1000 }),
          modifiedFile: fc.string({ maxLength: 1000 }),
          isDirty: fc.boolean(),
          timestamp: fc.integer({ min: 0, max: Date.now() }),
        }),
        (payload: FileContextPayload) => {
          // The component should render without throwing errors
          const { container } = render(<DiffViewer payload={payload} />);
          
          // Basic assertions that should hold for any valid payload
          expect(container).toBeTruthy();
          
          // The fileName should be displayed
          expect(container.textContent).toContain(payload.fileName);
          
          // If isDirty is true, the dirty indicator should be present
          if (payload.isDirty) {
            const dirtyIndicator = container.querySelector('[title="Unsaved changes"]');
            expect(dirtyIndicator).toBeTruthy();
          }
          
          // The timestamp should be formatted and displayed
          const formattedTimestamp = new Date(payload.timestamp).toLocaleString();
          expect(container.textContent).toContain(formattedTimestamp);
          
          // If files are identical, "No changes" should be shown
          if (payload.originalFile === payload.modifiedFile && payload.originalFile !== '') {
            expect(container.textContent).toContain('No changes');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 17: Diff rendering - should handle edge cases correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Empty files
          fc.constant({
            fileName: 'empty.txt',
            originalFile: '',
            modifiedFile: '',
            isDirty: false,
            timestamp: Date.now(),
          }),
          // Very long file names
          fc.record({
            fileName: fc.string({ minLength: 50, maxLength: 200 }),
            originalFile: fc.string({ maxLength: 100 }),
            modifiedFile: fc.string({ maxLength: 100 }),
            isDirty: fc.boolean(),
            timestamp: fc.integer({ min: 0, max: Date.now() }),
          }),
          // Files with special characters
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 50 }),
            originalFile: fc.stringOf(fc.constantFrom('\n', '\t', ' ', 'a', 'b', '1', '2')),
            modifiedFile: fc.stringOf(fc.constantFrom('\n', '\t', ' ', 'a', 'b', '1', '2')),
            isDirty: fc.boolean(),
            timestamp: fc.integer({ min: 0, max: Date.now() }),
          }),
          // New files (empty original)
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 50 }),
            originalFile: fc.constant(''),
            modifiedFile: fc.string({ minLength: 1, maxLength: 500 }),
            isDirty: fc.boolean(),
            timestamp: fc.integer({ min: 0, max: Date.now() }),
          })
        ),
        (payload: FileContextPayload) => {
          // Should render without errors for all edge cases
          const { container } = render(<DiffViewer payload={payload} />);
          expect(container).toBeTruthy();
          
          // FileName should always be present
          expect(container.textContent).toContain(payload.fileName);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 17: Diff rendering - should preserve content integrity', () => {
    fc.assert(
      fc.property(
        fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 50 }),
          originalFile: fc.string({ minLength: 10, maxLength: 200 }),
          modifiedFile: fc.string({ minLength: 10, maxLength: 200 }),
          isDirty: fc.boolean(),
          timestamp: fc.integer({ min: 0, max: Date.now() }),
        }),
        (payload: FileContextPayload) => {
          // Render the component
          const { container } = render(<DiffViewer payload={payload} />);
          
          // The component should not crash
          expect(container).toBeTruthy();
          
          // For non-identical files, the diff viewer should be rendered
          // (not showing "No changes")
          if (payload.originalFile !== payload.modifiedFile) {
            expect(container.textContent).not.toContain('No changes');
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
