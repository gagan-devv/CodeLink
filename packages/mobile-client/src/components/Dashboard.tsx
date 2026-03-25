import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, IconButton, Badge, ProgressBar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ConnectionStatus } from '../hooks/useConnection';
import { useOrientation } from '../hooks';
import { useConnectionQuality } from '../hooks/useConnectionQuality';

/**
 * Dashboard component props
 */
export interface DashboardProps {
  connectionStatus: ConnectionStatus;
  onNavigateToPrompts: () => void;
  onNavigateToDiffs: () => void;
  onReconnect?: () => void;
  pendingPromptsCount?: number;
  recentDiffsCount?: number;
  lastSyncTime?: Date | null;
}

/**
 * Dashboard component displays connection status and navigation buttons
 * Supports both portrait and landscape orientations with responsive layout
 * 
 * Requirements: 6.2, 6.5, 8.2, 8.3, 10.1, 10.2, 10.3, 10.4
 */
export const Dashboard: React.FC<DashboardProps> = ({
  connectionStatus,
  onNavigateToPrompts,
  onNavigateToDiffs,
  onReconnect,
  pendingPromptsCount = 0,
  recentDiffsCount = 0,
  lastSyncTime,
}) => {
  const { isLandscape } = useOrientation();
  const connectionMetrics = useConnectionQuality();

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

  /**
   * Get connection quality icon and color
   */
  const getQualityInfo = () => {
    switch (connectionMetrics.quality) {
      case 'excellent':
        return { icon: 'signal-cellular-3' as const, color: '#4CAF50' };
      case 'good':
        return { icon: 'signal-cellular-2' as const, color: '#8BC34A' };
      case 'fair':
        return { icon: 'signal-cellular-1' as const, color: '#FF9800' };
      case 'poor':
        return { icon: 'signal-cellular-outline' as const, color: '#F44336' };
      default:
        return { icon: 'signal-cellular-off' as const, color: '#9E9E9E' };
    }
  };

  const qualityInfo = getQualityInfo();

  /**
   * Format last sync time
   */
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      {/* App Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="code-braces" size={32} color="#6200ee" />
        <Text variant="headlineMedium" style={styles.appTitle}>
          CodeLink
        </Text>
      </View>

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
            <View style={styles.statusInfo}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
              {connectionStatus === 'connected' && connectionMetrics.latency && (
                <View style={styles.qualityRow}>
                  <MaterialCommunityIcons
                    name={qualityInfo.icon}
                    size={16}
                    color={qualityInfo.color}
                  />
                  <Text style={styles.latencyText}>
                    {connectionMetrics.latency}ms
                  </Text>
                </View>
              )}
            </View>
            {connectionStatus === 'disconnected' && onReconnect && (
              <IconButton
                icon="refresh"
                size={20}
                onPress={onReconnect}
              />
            )}
          </View>
          {connectionStatus === 'connecting' && (
            <ProgressBar indeterminate style={styles.progressBar} />
          )}
        </Card.Content>
      </Card>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="message-text" size={24} color="#6200ee" />
            <Text variant="headlineSmall" style={styles.statNumber}>
              {pendingPromptsCount}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Pending
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="file-compare" size={24} color="#03dac6" />
            <Text variant="headlineSmall" style={styles.statNumber}>
              {recentDiffsCount}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Recent Diffs
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Last Sync Info */}
      {lastSyncTime && (
        <Text variant="bodySmall" style={styles.lastSync}>
          Last sync: {formatLastSync()}
        </Text>
      )}

      {/* Navigation Buttons */}
      <View style={[styles.buttonContainer, isLandscape && styles.buttonContainerLandscape]}>
        <Button
          mode="contained"
          onPress={onNavigateToPrompts}
          style={[styles.navButton, isLandscape && styles.navButtonLandscape]}
          contentStyle={styles.buttonContent}
          icon="message-text"
        >
          Compose Prompt
        </Button>

        <Button
          mode="contained"
          onPress={onNavigateToDiffs}
          style={[styles.navButton, isLandscape && styles.navButtonLandscape]}
          contentStyle={styles.buttonContent}
          icon="file-compare"
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
  },
  containerLandscape: {
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  appTitle: {
    fontWeight: '700',
    color: '#6200ee',
  },
  statusCard: {
    marginBottom: 16,
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
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  latencyText: {
    fontSize: 12,
    color: '#666',
  },
  progressBar: {
    marginTop: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    elevation: 2,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  statNumber: {
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  lastSync: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
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
