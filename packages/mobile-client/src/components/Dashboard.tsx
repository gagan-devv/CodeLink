import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { ConnectionStatus } from '../hooks/useConnection';

/**
 * Dashboard component props
 */
export interface DashboardProps {
  connectionStatus: ConnectionStatus;
  onNavigateToPrompts: () => void;
  onNavigateToDiffs: () => void;
}

/**
 * Dashboard component displays connection status and navigation buttons
 * Supports both portrait and landscape orientations
 * 
 * Requirements: 6.2, 6.5, 8.2, 8.3, 10.1, 10.2
 */
export const Dashboard: React.FC<DashboardProps> = ({
  connectionStatus,
  onNavigateToPrompts,
  onNavigateToDiffs
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  /**
   * Get status indicator color based on connection status
   */
  const getStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50'; // Green
      case 'disconnected':
        return '#F44336'; // Red
      case 'connecting':
        return '#FF9800'; // Orange
    }
  };

  /**
   * Get status text based on connection status
   */
  const getStatusText = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
    }
  };

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      {/* Connection Status Card */}
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor() }
              ]}
            />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Navigation Buttons */}
      <View style={[styles.buttonContainer, isLandscape && styles.buttonContainerLandscape]}>
        <Button
          mode="contained"
          onPress={onNavigateToPrompts}
          style={[styles.navButton, isLandscape && styles.navButtonLandscape]}
          contentStyle={styles.buttonContent}
        >
          Compose Prompt
        </Button>

        <Button
          mode="contained"
          onPress={onNavigateToDiffs}
          style={[styles.navButton, isLandscape && styles.navButtonLandscape]}
          contentStyle={styles.buttonContent}
        >
          View Diffs
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  containerLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statusCard: {
    marginBottom: 24,
    elevation: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  buttonContainer: {
    gap: 16,
  },
  buttonContainerLandscape: {
    flexDirection: 'row',
    gap: 24,
  },
  navButton: {
    marginVertical: 8,
  },
  navButtonLandscape: {
    flex: 1,
    marginVertical: 0,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
