/**
 * AppLoading Component
 *
 * Displays a loading screen while the app initializes (e.g., loading fonts).
 *
 * Requirements: 2.5, 26.8, 26.9
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { getActivityIndicatorSize } from '../utils/platformAdaptations';

export interface AppLoadingProps {
  message?: string;
}

/**
 * Loading screen component
 *
 * Shows a centered activity indicator with optional message
 * while the app is initializing.
 *
 * Uses platform-specific activity indicator styles:
 * - iOS: UIActivityIndicatorView style
 * - Android: Material Design CircularProgressIndicator style
 */
export const AppLoading: React.FC<AppLoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={getActivityIndicatorSize()} color="#95ccff" />
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
