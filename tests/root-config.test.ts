import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Feature: codelink-initialization, Property 1: Required project structure exists
describe('Property 1: Required project structure exists', () => {
  it('should have all required root configuration files', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        
        // Required root files
        const requiredFiles = [
          'package.json',
          'tsconfig.base.json',
          '.eslintrc.json',
          '.prettierrc.json',
          '.gitignore',
        ];

        for (const file of requiredFiles) {
          const filePath = path.join(rootDir, file);
          const exists = fs.existsSync(filePath);
          if (!exists) {
            throw new Error(`Required file missing: ${file}`);
          }
        }

        // Required packages directory
        const packagesDir = path.join(rootDir, 'packages');
        if (!fs.existsSync(packagesDir)) {
          throw new Error('Required directory missing: packages/');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should have packages directory structure', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const packagesDir = path.join(rootDir, 'packages');

        // Check packages directory exists
        if (!fs.existsSync(packagesDir)) {
          throw new Error('packages/ directory does not exist');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: codelink-initialization, Property 4: Configuration files contain no placeholder content
describe('Property 4: Configuration files contain no placeholder content', () => {
  it('should not contain placeholder markers in configuration files', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        
        const configFiles = [
          'package.json',
          'tsconfig.base.json',
          '.eslintrc.json',
          '.prettierrc.json',
        ];

        const placeholderPatterns = [
          /TODO/i,
          /FIXME/i,
          /PLACEHOLDER/i,
          /CHANGEME/i,
        ];

        for (const file of configFiles) {
          const filePath = path.join(rootDir, file);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            for (const pattern of placeholderPatterns) {
              if (pattern.test(content)) {
                throw new Error(
                  `Configuration file ${file} contains placeholder content matching ${pattern}`
                );
              }
            }
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
