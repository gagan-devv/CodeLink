/**
 * AppLoading Component
 *
 * Displays a loading screen while the app initializes (e.g., loading fonts).
 *
 * Requirements: 2.5
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export interface AppLoadingProps {
  message?: string;
}

/**
 * Loading screen component
 *
 * Shows a centered activity indicator with optional message
 * while the app is initializing.
 */
export const AppLoading: React.FC<AppLoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#95ccff" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#131313', // surface color from design system
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#e0e0e0', // onSurface color
    fontFamily: 'System',
  },
});
