import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Root Vitest configuration
 * Combines Node.js and React Native test environments
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: [
        'packages/protocol/src/**/*.ts',
        'packages/vscode-extension/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.config.js',
        '**/*.config.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    globals: true,
    testTimeout: 10000,
    sourcemap: false
  },
  resolve: {
    alias: {
      '@codelink/protocol': path.resolve(__dirname, './packages/protocol/src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    conditions: ['import', 'module', 'browser', 'default'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  }
});
