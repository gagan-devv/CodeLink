import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Feature: codelink-initialization, Property 2: All package.json files contain required fields
describe('Property 2: All package.json files contain required fields', () => {
  it('should have required fields in all package.json files', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const packagesDir = path.join(rootDir, 'packages');

        // Check if packages directory exists
        if (!fs.existsSync(packagesDir)) {
          return true; // Skip if packages don't exist yet
        }

        const packageDirs = fs.readdirSync(packagesDir).filter((name) => {
          const fullPath = path.join(packagesDir, name);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const pkgDir of packageDirs) {
          const pkgJsonPath = path.join(packagesDir, pkgDir, 'package.json');

          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

            // Required fields for all packages
            if (!pkgJson.name) {
              throw new Error(`${pkgDir}/package.json missing required field: name`);
            }
            if (!pkgJson.version) {
              throw new Error(`${pkgDir}/package.json missing required field: version`);
            }
            if (!pkgJson.scripts) {
              throw new Error(`${pkgDir}/package.json missing required field: scripts`);
            }
            if (!pkgJson.scripts.build) {
              throw new Error(`${pkgDir}/package.json missing required script: build`);
            }
            if (!pkgJson.scripts.dev) {
              throw new Error(`${pkgDir}/package.json missing required script: dev`);
            }

            // VS Code extension specific requirements
            if (pkgDir === 'vscode-extension') {
              if (!pkgJson.engines) {
                throw new Error(`${pkgDir}/package.json missing required field: engines`);
              }
              if (!pkgJson.activationEvents) {
                throw new Error(`${pkgDir}/package.json missing required field: activationEvents`);
              }
            }

            // Mobile client specific requirements
            if (pkgDir === 'mobile-client') {
              if (pkgJson.type !== 'module') {
                throw new Error(
                  `${pkgDir}/package.json missing or incorrect field: type (should be "module")`
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

// Feature: codelink-initialization, Property 3: All TypeScript configurations extend base configuration
describe('Property 3: All TypeScript configurations extend base configuration', () => {
  it('should extend tsconfig.base.json in all package tsconfig files', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const packagesDir = path.join(rootDir, 'packages');

        // Check if packages directory exists
        if (!fs.existsSync(packagesDir)) {
          return true; // Skip if packages don't exist yet
        }

        const packageDirs = fs.readdirSync(packagesDir).filter((name) => {
          const fullPath = path.join(packagesDir, name);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const pkgDir of packageDirs) {
          const tsconfigPath = path.join(packagesDir, pkgDir, 'tsconfig.json');

          if (fs.existsSync(tsconfigPath)) {
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

            if (!tsconfig.extends) {
              throw new Error(`${pkgDir}/tsconfig.json missing "extends" field`);
            }

            // Verify it extends the base config
            const extendsPath = tsconfig.extends;
            if (!extendsPath.includes('tsconfig.base.json')) {
              throw new Error(
                `${pkgDir}/tsconfig.json does not extend tsconfig.base.json (extends: ${extendsPath})`
              );
            }
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: codelink-initialization, Property 5: All packages have appropriate entry points
describe('Property 5: All packages have appropriate entry points', () => {
  it('should define entry points in package.json for packages that produce output', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const packagesDir = path.join(rootDir, 'packages');

        // Check if packages directory exists
        if (!fs.existsSync(packagesDir)) {
          return true; // Skip if packages don't exist yet
        }

        const packageDirs = fs.readdirSync(packagesDir).filter((name) => {
          const fullPath = path.join(packagesDir, name);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const pkgDir of packageDirs) {
          const pkgJsonPath = path.join(packagesDir, pkgDir, 'package.json');

          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

            // All packages should have a main entry point
            if (!pkgJson.main) {
              throw new Error(`${pkgDir}/package.json missing "main" entry point`);
            }

            // Verify main points to dist directory
            if (!pkgJson.main.includes('dist')) {
              throw new Error(
                `${pkgDir}/package.json main entry point should point to dist/ directory (got: ${pkgJson.main})`
              );
            }
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
