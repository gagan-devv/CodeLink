import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Use jsdom for mobile-client tests, node for everything else
    environment: 'node',
    environmentMatchGlobs: [
      ['packages/mobile-client/**', 'jsdom'],
    ],
    alias: {
      vscode: path.resolve(__dirname, './test-mocks/vscode.ts'),
    },
    setupFiles: ['./packages/mobile-client/src/test-setup.ts'],
  },
});
