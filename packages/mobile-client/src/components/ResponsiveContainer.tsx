/**
 * Responsive Container Component
 *
 * Wraps content with responsive width constraints and centering.
 *
 * Requirements:
 * - 13.3: Use maximum content width of 1024px on large screens
 * - 13.4: Center content horizontally on wide screens
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

/**
 * Props for ResponsiveContainer
 */
export interface ResponsiveContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Container that constrains content width and centers on large screens
 *
 * Automatically applies:
 * - Maximum width of 1024px on screens wider than that
 * - Horizontal centering when content is constrained
 * - Full width on smaller screens
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ children, style }) => {
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.container,
        {
          width: layout.contentWidth,
          marginHorizontal: layout.shouldCenterContent ? layout.contentMarginHorizontal : 0,
          alignSelf: layout.shouldCenterContent ? 'center' : 'stretch',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
