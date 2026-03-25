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
    setupFiles: ['./tests/setup/test-setup.ts'],
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
    // Use jsdom for React Native component tests
    environmentMatchGlobs: [
      ['tests/unit/mobile-client/**', 'jsdom']
    ]
  },
  resolve: {
    alias: {
      '@codelink/protocol': path.resolve(__dirname, './packages/protocol/src'),
      // Alias react-native to our mock for testing
      'react-native$': path.resolve(__dirname, './tests/setup/react-native-mock.ts'),
      'react-native/': path.resolve(__dirname, './packages/mobile-client/node_modules/react-native/')
    },
    conditions: ['import', 'module', 'browser', 'default'],
  }
});
