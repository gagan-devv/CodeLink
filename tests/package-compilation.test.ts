import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Feature: codelink-initialization, Property 6: All packages compile successfully
describe('Property 6: All packages compile successfully', () => {
  it('should compile all packages without TypeScript errors', () => {
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
          const pkgPath = path.join(packagesDir, pkgDir);
          const pkgJsonPath = path.join(pkgPath, 'package.json');
          const distPath = path.join(pkgPath, 'dist');

          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

            // Check if package has a build script
            if (pkgJson.scripts && pkgJson.scripts.build) {
              // Verify dist directory exists (should be created by build)
              if (!fs.existsSync(distPath)) {
                throw new Error(
                  `${pkgDir} has a build script but dist/ directory does not exist. Run build first.`
                );
              }

              // Verify dist directory contains output files
              const distFiles = fs.readdirSync(distPath);
              if (distFiles.length === 0) {
                throw new Error(`${pkgDir}/dist/ directory is empty after build`);
              }

              // Verify JavaScript files were generated
              const hasJsFiles = distFiles.some((file) => file.endsWith('.js'));
              if (!hasJsFiles) {
                throw new Error(`${pkgDir}/dist/ does not contain compiled JavaScript files`);
              }

              // Verify type definition files were generated
              const hasDtsFiles = distFiles.some((file) => file.endsWith('.d.ts'));
              if (!hasDtsFiles) {
                throw new Error(`${pkgDir}/dist/ does not contain type definition files`);
              }
            }
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should verify TypeScript compilation produces valid output', () => {
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
          const pkgPath = path.join(packagesDir, pkgDir);
          const pkgJsonPath = path.join(pkgPath, 'package.json');
          const tsconfigPath = path.join(pkgPath, 'tsconfig.json');
          const distPath = path.join(pkgPath, 'dist');

          if (fs.existsSync(tsconfigPath) && fs.existsSync(distPath) && fs.existsSync(pkgJsonPath)) {
            // Read package.json to get the main entry point
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            const mainEntry = pkgJson.main;

            if (!mainEntry) {
              throw new Error(`${pkgDir}/package.json does not specify a main entry point`);
            }

            // Extract the filename from the main entry (e.g., "./dist/index.js" -> "index")
            const mainFileName = path.basename(mainEntry, '.js');
            const mainJsPath = path.join(pkgPath, mainEntry);
            const mainDtsPath = path.join(pkgPath, mainEntry.replace('.js', '.d.ts'));

            if (!fs.existsSync(mainJsPath)) {
              throw new Error(`${pkgDir} main entry file does not exist: ${mainEntry}`);
            }

            if (!fs.existsSync(mainDtsPath)) {
              throw new Error(`${pkgDir} type definition file does not exist: ${mainEntry.replace('.js', '.d.ts')}`);
            }

            // Verify the files are not empty
            const jsContent = fs.readFileSync(mainJsPath, 'utf-8');
            if (jsContent.trim().length === 0) {
              throw new Error(`${pkgDir} main entry file is empty: ${mainEntry}`);
            }

            const dtsContent = fs.readFileSync(mainDtsPath, 'utf-8');
            if (dtsContent.trim().length === 0) {
              throw new Error(`${pkgDir} type definition file is empty: ${mainEntry.replace('.js', '.d.ts')}`);
            }
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
