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
        ]
      }
    }
  },
  resolve: {
    // Use array form so we can include regex-based aliases for deep imports
    alias: [
      { find: '@codelink/protocol', replacement: path.resolve(__dirname, './packages/protocol/src') },
      // Alias react-native to our mock for testing
      { find: 'react-native', replacement: path.resolve(__dirname, './tests/setup/react-native-mock.ts') },
      { find: 'react-native/', replacement: path.resolve(__dirname, './packages/mobile-client/node_modules/react-native/') },
      // Resolve React from root node_modules (monorepo setup)
      { find: 'react', replacement: path.resolve(__dirname, './node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, './node_modules/react-dom') },
      // Explicitly resolve @testing-library/react-native from root node_modules
      { find: '@testing-library/react-native', replacement: path.resolve(__dirname, './node_modules/@testing-library/react-native/build/index.js') },
      // Ensure deep imports like @testing-library/react-native/src/... map to the compiled build/ equivalents
      { find: /^@testing-library\/react-native\/src\/(.*)/, replacement: path.resolve(__dirname, './node_modules/@testing-library/react-native/build/') + '$1' },
      // Fallback mapping for other deep imports under the package root
      { find: '@testing-library/react-native/', replacement: path.resolve(__dirname, './node_modules/@testing-library/react-native/build/') }
    ],
    conditions: ['import', 'module', 'browser', 'default'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  }
});
