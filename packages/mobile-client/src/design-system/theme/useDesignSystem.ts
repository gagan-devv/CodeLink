/**
 * useDesignSystem Hook
 *
 * Custom React hook for accessing the design system theme.
 * Provides type-safe access to theme configuration and update function.
 *
 * Requirements: 1.6
 */

import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

/**
 * Hook for accessing the design system theme.
 * Must be used within a ThemeProvider component.
 *
 * @returns Theme context value with theme, config, and setConfig
 * @throws Error if used outside of ThemeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, config, setConfig } = useDesignSystem();
 *
 *   return (
 *     <View style={{ backgroundColor: theme.colors.surface }}>
 *       <Text style={{ color: theme.colors.onSurface }}>
 *         Hello World
 *       </Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useDesignSystem() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useDesignSystem must be used within a ThemeProvider');
  }

  return context;
}
