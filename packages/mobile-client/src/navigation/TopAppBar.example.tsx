/**
 * TopAppBar Usage Examples
 *
 * This file demonstrates how to use the TopAppBar component in different scenarios.
 */

import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { TopAppBar } from './TopAppBar';
import { Text } from '../design-system/typography/Text';

/**
 * Example 1: Basic usage with connected status
 */
export const BasicConnectedExample = () => {
  return (
    <View style={styles.container}>
      <TopAppBar connectionStatus="connected" />
      <ScrollView style={styles.content}>
        <Text variant="body-md" color="onSurface">
          This example shows the TopAppBar with a connected status. The status indicator will show a
          green dot with "Connected" label.
        </Text>
      </ScrollView>
    </View>
  );
};

/**
 * Example 2: Disconnected status
 */
export const DisconnectedExample = () => {
  return (
    <View style={styles.container}>
      <TopAppBar connectionStatus="disconnected" />
      <ScrollView style={styles.content}>
        <Text variant="body-md" color="onSurface">
          This example shows the TopAppBar with a disconnected status. The status indicator will
          show a red dot with "Disconnected" label.
        </Text>
      </ScrollView>
    </View>
  );
};

/**
 * Example 3: Connecting status with pulse animation
 */
export const ConnectingExample = () => {
  return (
    <View style={styles.container}>
      <TopAppBar connectionStatus="connecting" />
      <ScrollView style={styles.content}>
        <Text variant="body-md" color="onSurface">
          This example shows the TopAppBar with a connecting status. The status indicator will show
          an orange dot with pulse animation.
        </Text>
      </ScrollView>
    </View>
  );
};

/**
 * Example 4: Integration with screen component
 */
export const ScreenIntegrationExample = () => {
  const [connectionStatus, setConnectionStatus] = React.useState<
    'connected' | 'disconnected' | 'connecting'
  >('connecting');

  // Simulate connection status changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <TopAppBar connectionStatus={connectionStatus} />
      <ScrollView style={styles.content}>
        <Text variant="headline-md" weight="bold" color="onSurface">
          Dashboard
        </Text>
        <Text variant="body-md" color="onSurfaceVariant" style={{ marginTop: 8 }}>
          This example demonstrates how to integrate the TopAppBar with a screen component. The
          connection status will change from "connecting" to "connected" after 3 seconds.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
