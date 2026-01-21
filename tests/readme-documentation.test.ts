import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Feature: codelink-initialization, Property 8: README contains required documentation sections
describe('Property 8: README contains required documentation sections', () => {
  it('should have README.md file in root directory', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          throw new Error('README.md file does not exist in root directory');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should contain architecture overview section', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');

        // Check for architecture overview section
        if (!content.includes('Architecture') && !content.includes('architecture')) {
          throw new Error('README.md missing architecture overview section');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should document the three main components', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');

        // Check for VS Code extension documentation
        if (!content.includes('VS Code') && !content.includes('vscode-extension')) {
          throw new Error('README.md missing VS Code extension documentation');
        }

        // Check for relay server documentation
        if (!content.includes('relay') && !content.includes('Relay')) {
          throw new Error('README.md missing relay server documentation');
        }

        // Check for mobile client documentation
        if (!content.includes('mobile') && !content.includes('Mobile')) {
          throw new Error('README.md missing mobile client documentation');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should contain setup instructions', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');

        // Check for setup/installation section
        if (!content.includes('Setup') && !content.includes('Installation')) {
          throw new Error('README.md missing setup/installation section');
        }

        // Check for npm install command
        if (!content.includes('npm install')) {
          throw new Error('README.md missing npm install command in setup instructions');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should contain development instructions', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');

        // Check for development section
        if (!content.includes('Development') && !content.includes('Running')) {
          throw new Error('README.md missing development instructions section');
        }

        // Check for npm run dev command
        if (!content.includes('npm run dev')) {
          throw new Error('README.md missing npm run dev command in development instructions');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should explain core principles', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');

        // Check for core principles section
        if (!content.includes('Principles') && !content.includes('principles')) {
          throw new Error('README.md missing core principles section');
        }

        // Check for key principles
        const lowerContent = content.toLowerCase();
        
        if (!lowerContent.includes('cloud') && !lowerContent.includes('ide')) {
          throw new Error('README.md missing explanation of "no cloud IDE" principle');
        }

        if (!lowerContent.includes('approval') || !lowerContent.includes('human')) {
          throw new Error('README.md missing explanation of "human approval required" principle');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should document unified diff as primary UI artifact', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');
        const lowerContent = content.toLowerCase();

        // Check for unified diff or diff mention
        if (!lowerContent.includes('diff')) {
          throw new Error('README.md missing documentation about unified diff UI');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should document code quality scripts', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const readmePath = path.join(rootDir, 'README.md');

        if (!fs.existsSync(readmePath)) {
          return true; // Skip if README doesn't exist yet
        }

        const content = fs.readFileSync(readmePath, 'utf-8');

        // Check for lint command
        if (!content.includes('npm run lint') && !content.includes('lint')) {
          throw new Error('README.md missing lint script documentation');
        }

        // Check for format command
        if (!content.includes('npm run format') && !content.includes('format')) {
          throw new Error('README.md missing format script documentation');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
