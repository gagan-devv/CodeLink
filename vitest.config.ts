import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Use jsdom for mobile-client tests, node for everything else
    environment: 'node',
    environmentMatchGlobs: [
      ['packages/mobile-client/**', 'jsdom'],
    ],
    alias: {
      vscode: new URL('./test-mocks/vscode.ts', import.meta.url).pathname,
    },
    setupFiles: ['./packages/mobile-client/src/test-setup.ts'],
  },
});
