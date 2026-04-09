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
      'tests/unit/protocol/**/*.test.ts',
      'tests/unit/relay-server/**/*.test.ts',
      'tests/unit/vscode-extension/**/*.test.ts',
      'tests/unit/mobile-client/**/*.test.tsx',
      'tests/unit/mobile-client/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/property/**/*.test.ts',
      'tests/performance/**/*.test.ts'
    ],
    exclude: [
      'tests/unit/mobile-client/components.test.tsx'
    ],
    setupFiles: ['./tests/setup/test-setup.ts', './tests/setup/react-native-testing-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: [
        'packages/protocol/src/**/*.ts',
        'packages/relay-server/src/**/*.ts',
        'packages/vscode-extension/src/**/*.ts',
        'packages/mobile-client/src/**/*.ts',
        'packages/mobile-client/src/**/*.tsx'
      ],
      exclude: [
        'tests/**',
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
    // Disable source map resolution to prevent loading TypeScript sources
    sourcemap: false,
    // Use jsdom for React Native component tests
    environmentMatchGlobs: [
      ['tests/unit/mobile-client/**', 'jsdom']
    ],
    // Transform node_modules that need transpilation
    server: {
      deps: {
        inline: [
          'react-native',
          '@testing-library/react-native',
        ],
        // Don't externalize @testing-library/react-native so it gets transformed
        external: []
      }
    },
    // Explicitly exclude node_modules from transformation except those we inline
    exclude: [
      ...['node_modules/**'],
      'tests/unit/mobile-client/components.test.tsx'
    ]
  },
  resolve: {
    alias: {
      '@codelink/protocol': path.resolve(__dirname, './packages/protocol/src'),
      // Alias react-native to our mock for testing
      'react-native': path.resolve(__dirname, './tests/setup/react-native-mock.ts'),
      // Resolve React from root node_modules (monorepo setup)
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    conditions: ['import', 'module', 'browser', 'default'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  }
});
