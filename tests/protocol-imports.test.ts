import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Feature: codelink-initialization, Property 7: Protocol package exports are importable
describe('Property 7: Protocol package exports are importable', () => {
  it('should allow vscode-extension to import PingMessage from @codelink/protocol', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const extensionSrcPath = path.join(
          rootDir,
          'packages',
          'vscode-extension',
          'src',
          'extension.ts'
        );

        // Check if extension source exists
        if (!fs.existsSync(extensionSrcPath)) {
          throw new Error('vscode-extension/src/extension.ts does not exist');
        }

        const extensionSrc = fs.readFileSync(extensionSrcPath, 'utf-8');

        // Verify the extension imports from @codelink/protocol
        const hasProtocolImport = extensionSrc.includes('@codelink/protocol');
        if (!hasProtocolImport) {
          throw new Error('vscode-extension does not import from @codelink/protocol');
        }

        // Verify PingMessage is imported or used
        const usesPingMessage = extensionSrc.includes('PingMessage');
        if (!usesPingMessage) {
          throw new Error('vscode-extension does not use PingMessage type');
        }

        // Verify the package.json has the dependency
        const pkgJsonPath = path.join(rootDir, 'packages', 'vscode-extension', 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          const hasDependency = pkgJson.dependencies && pkgJson.dependencies['@codelink/protocol'];
          if (!hasDependency) {
            throw new Error(
              'vscode-extension package.json does not list @codelink/protocol as a dependency'
            );
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should allow relay-server to import ProtocolMessage from @codelink/protocol', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const serverSrcPath = path.join(rootDir, 'packages', 'relay-server', 'src', 'index.ts');

        // Check if server source exists
        if (!fs.existsSync(serverSrcPath)) {
          throw new Error('relay-server/src/index.ts does not exist');
        }

        const serverSrc = fs.readFileSync(serverSrcPath, 'utf-8');

        // Verify the server imports from @codelink/protocol
        const hasProtocolImport = serverSrc.includes('@codelink/protocol');
        if (!hasProtocolImport) {
          throw new Error('relay-server does not import from @codelink/protocol');
        }

        // Verify ProtocolMessage is imported or used
        const usesProtocolMessage = serverSrc.includes('ProtocolMessage');
        if (!usesProtocolMessage) {
          throw new Error('relay-server does not use ProtocolMessage type');
        }

        // Verify the package.json has the dependency
        const pkgJsonPath = path.join(rootDir, 'packages', 'relay-server', 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          const hasDependency = pkgJson.dependencies && pkgJson.dependencies['@codelink/protocol'];
          if (!hasDependency) {
            throw new Error(
              'relay-server package.json does not list @codelink/protocol as a dependency'
            );
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should allow mobile-client to import PongMessage from @codelink/protocol', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const rootDir = path.resolve(__dirname, '..');
        const clientSrcPath = path.join(rootDir, 'packages', 'mobile-client', 'src', 'App.tsx');

        // Check if client source exists
        if (!fs.existsSync(clientSrcPath)) {
          throw new Error('mobile-client/src/App.tsx does not exist');
        }

        const clientSrc = fs.readFileSync(clientSrcPath, 'utf-8');

        // Verify the client imports from @codelink/protocol
        const hasProtocolImport = clientSrc.includes('@codelink/protocol');
        if (!hasProtocolImport) {
          throw new Error('mobile-client does not import from @codelink/protocol');
        }

        // Verify PongMessage is imported or used
        const usesPongMessage = clientSrc.includes('PongMessage');
        if (!usesPongMessage) {
          throw new Error('mobile-client does not use PongMessage type');
        }

        // Verify the package.json has the dependency
        const pkgJsonPath = path.join(rootDir, 'packages', 'mobile-client', 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          const hasDependency = pkgJson.dependencies && pkgJson.dependencies['@codelink/protocol'];
          if (!hasDependency) {
            throw new Error(
              'mobile-client package.json does not list @codelink/protocol as a dependency'
            );
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
