import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Dimensions, RefreshControl } from 'react-native';
import { useDesignSystem } from '../design-system';
import { Text } from '../design-system/typography/Text';
import { Card } from '../design-system/components/Card';
import { Icon } from '../design-system/components/Icon';
import { Button } from '../design-system/components/Button';
import { ProgressBar } from '../design-system/components/ProgressBar';
import { StatusIndicator, ConnectionStatus } from '../design-system/components/StatusIndicator';
import { TopAppBar } from '../navigation/TopAppBar';
import { useLoadingAnnouncement } from '../hooks/useScreenReaderAnnouncement';

/**
 * System metrics interface
 */
export interface SystemMetrics {
  uptime: number;
  latency: number;
  load: number;
  region: string;
  trafficSent: number;
  trafficReceived: number;
}

/**
 * Activity item interface
 */
export interface ActivityItem {
  id: string;
  type: 'commit' | 'sync' | 'build' | 'deploy';
  message: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

/**
 * Dashboard component props
 */
export interface DashboardProps {
  connectionStatus: ConnectionStatus;
  connectionError?: Error | null;
  onRetry?: () => void;
  metrics?: SystemMetrics;
  recentActivity?: ActivityItem[];
  onNavigateToDiffs: () => void;
  onNavigateToCompose: () => void;
  onRefresh?: () => Promise<void>;
}

/**
 * Dashboard component displays system overview with bento grid layout
 *
 * Features:
 * - TopAppBar with connection status
 * - System Overview section with bento grid layout
 * - System Health section with status cards
 * - Shortcuts section with navigation cards
 * - Recent Activity section with activity feed
 * - Responsive grid (2 columns on large screens, 1 on small)
 * - Asymmetrical spacing and card sizes for bento pattern
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 13.5, 13.6, 15.3
 */
export const Dashboard: React.FC<DashboardProps> = ({
  connectionStatus,
  connectionError = null,
  onRetry,
  metrics = {
    uptime: 99.8,
    latency: 45,
    load: 0.65,
    region: 'us-west-2',
    trafficSent: 2.5,
    trafficReceived: 8.3,
  },
  recentActivity = [],
  onNavigateToDiffs,
  onNavigateToCompose,
  onRefresh,
}) => {
  const { theme } = useDesignSystem();
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Announce loading state for accessibility
  // Requirement 14.11: Announce loading states
  useLoadingAnnouncement(refreshing, 'Refreshing dashboard data', 'Dashboard refreshed');

  // Detect screen size for responsive layout (Requirement 13.5)
  useEffect(() => {
    const updateLayout = () => {
      const { width } = Dimensions.get('window');
      setIsLargeScreen(width >= 768);
    };

    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription?.remove();
  }, []);

  /**
   * Handle refresh (Requirement 3.1)
   */
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Format uptime percentage (Requirement 3.3)
   */
  const formatUptime = (uptime: number): string => {
    return `${uptime.toFixed(1)}%`;
  };

  /**
   * Format traffic volume (Requirement 3.4)
   */
  const formatTraffic = (traffic: number): string => {
    return `${traffic.toFixed(1)} GB`;
  };

  /**
   * Format activity timestamp (Requirement 3.7)
   */
  const formatActivityTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  /**
   * Get activity type icon (Requirement 3.7)
   */
  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'commit':
        return 'check-circle';
      case 'sync':
        return 'sync';
      case 'build':
        return 'build';
      case 'deploy':
        return 'cloud-upload';
      default:
        return 'info';
    }
  };

  /**
   * Render activity feed item (Requirement 3.7, 15.3)
   */
  const renderActivityItem = ({ item }: { item: ActivityItem }) => (
    <View style={styles.activityItem}>
      <Icon
        name={getActivityIcon(item.type)}
        size={20}
        color="primary"
        style={styles.activityIcon}
      />
      <View style={styles.activityContent}>
        <Text variant="body-sm" color="onSurface">
          {item.message}
        </Text>
        <Text variant="label-sm" color="onSurfaceVariant" style={styles.activityTime}>
          {formatActivityTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Top App Bar (Requirement 3.1) */}
      <TopAppBar connectionStatus={connectionStatus} />

      {/* Connection Error Banner (Requirement 17.3, 17.9) */}
      {connectionError && connectionStatus === 'disconnected' && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: `${theme.colors.errorContainer}26`,
              borderBottomColor: theme.colors.error,
            },
          ]}
        >
          <Icon name="error" size={20} color="error" />
          <View style={styles.errorContent}>
            <Text variant="body-sm" weight="semibold" color="error">
              Connection Failed
            </Text>
            <Text variant="body-sm" color="onSurfaceVariant" style={styles.errorMessage}>
              {connectionError.message || 'Unable to connect to relay server'}
            </Text>
          </View>
          {onRetry && (
            <Button
              variant="tertiary"
              size="sm"
              onPress={onRetry}
              icon={<Icon name="refresh" size={16} color="secondary" />}
              accessibilityLabel="Retry connection"
              accessibilityHint="Attempts to reconnect to the relay server"
            >
              Retry
            </Button>
          )}
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* System Overview Section (Requirement 3.2) */}
        <View style={styles.section}>
          <Text variant="headline-md" weight="bold" color="onSurface" style={styles.sectionTitle}>
            System Overview
          </Text>

          {/* Bento Grid Layout (Requirement 3.8, 13.6) */}
          <View style={[styles.bentoGrid, isLargeScreen && styles.bentoGridLarge]}>
            {/* Large card: Uptime (Requirement 3.3) */}
            <Card
              variant="low"
              padding="lg"
              style={[styles.bentoCard, isLargeScreen && styles.bentoCardLarge]}
            >
              <Text variant="label-sm" color="onSurfaceVariant" uppercase style={styles.cardLabel}>
                Uptime
              </Text>
              <Text variant="display-sm" weight="bold" color="secondary" style={styles.largeMetric}>
                {formatUptime(metrics.uptime)}
              </Text>
              <Text variant="body-sm" color="onSurfaceVariant" style={styles.cardDescription}>
                System availability
              </Text>
            </Card>

            {/* Small cards: Latency and Load (Requirement 3.3) */}
            <View style={[styles.bentoColumn, isLargeScreen && styles.bentoColumnSmall]}>
              <Card variant="low" padding="md" style={styles.bentoCard}>
                <Text
                  variant="label-sm"
                  color="onSurfaceVariant"
                  uppercase
                  style={styles.cardLabel}
                >
                  Latency
                </Text>
                <Text
                  variant="headline-lg"
                  weight="bold"
                  color="primary"
                  style={styles.mediumMetric}
                >
                  {metrics.latency}ms
                </Text>
              </Card>

              <Card variant="low" padding="md" style={styles.bentoCard}>
                <Text
                  variant="label-sm"
                  color="onSurfaceVariant"
                  uppercase
                  style={styles.cardLabel}
                >
                  Load
                </Text>
                <Text
                  variant="headline-lg"
                  weight="bold"
                  color="tertiary"
                  style={styles.mediumMetric}
                >
                  {(metrics.load * 100).toFixed(0)}%
                </Text>
              </Card>
            </View>
          </View>

          {/* Traffic Volume Section (Requirement 3.4, 3.9) */}
          <Card variant="low" padding="lg" style={styles.trafficCard}>
            <Text variant="label-sm" color="onSurfaceVariant" uppercase style={styles.cardLabel}>
              Traffic Volume
            </Text>
            <View style={styles.trafficRow}>
              <View style={styles.trafficColumn}>
                <Text variant="body-sm" color="onSurfaceVariant" style={styles.trafficLabel}>
                  Sent
                </Text>
                <ProgressBar
                  progress={Math.min(metrics.trafficSent * 10, 100)}
                  variant="secondary"
                  style={styles.trafficBar}
                />
                <Text variant="label-sm" color="secondary" style={styles.trafficValue}>
                  {formatTraffic(metrics.trafficSent)}
                </Text>
              </View>
              <View style={styles.trafficColumn}>
                <Text variant="body-sm" color="onSurfaceVariant" style={styles.trafficLabel}>
                  Received
                </Text>
                <ProgressBar
                  progress={Math.min(metrics.trafficReceived * 10, 100)}
                  variant="primary"
                  style={styles.trafficBar}
                />
                <Text variant="label-sm" color="primary" style={styles.trafficValue}>
                  {formatTraffic(metrics.trafficReceived)}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* System Health Section (Requirement 3.5) */}
        <View style={styles.section}>
          <Text variant="headline-md" weight="bold" color="onSurface" style={styles.sectionTitle}>
            System Health
          </Text>

          <View style={styles.healthGrid}>
            <Card variant="low" padding="lg" style={styles.healthCard}>
              <View style={styles.healthCardContent}>
                <StatusIndicator status={connectionStatus} size="md" animated={true} />
                <View style={styles.healthCardText}>
                  <Text variant="body-md" weight="bold" color="onSurface">
                    Relay Server
                  </Text>
                  <Text variant="body-sm" color="onSurfaceVariant">
                    {connectionStatus === 'connected'
                      ? 'Connected'
                      : connectionStatus === 'connecting'
                        ? 'Connecting'
                        : 'Disconnected'}
                  </Text>
                </View>
              </View>
            </Card>

            <Card variant="low" padding="lg" style={styles.healthCard}>
              <View style={styles.healthCardContent}>
                <StatusIndicator status="connected" size="md" animated={false} />
                <View style={styles.healthCardText}>
                  <Text variant="body-md" weight="bold" color="onSurface">
                    API
                  </Text>
                  <Text variant="body-sm" color="onSurfaceVariant">
                    Connected
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </View>

        {/* Shortcuts Section (Requirement 3.6) */}
        <View style={styles.section}>
          <Text variant="headline-md" weight="bold" color="onSurface" style={styles.sectionTitle}>
            Shortcuts
          </Text>

          <View style={styles.shortcutsGrid}>
            <Card
              variant="low"
              padding="lg"
              onPress={onNavigateToDiffs}
              style={styles.shortcutCard}
              accessibilityLabel="Diff Viewer shortcut"
              accessibilityHint="Double tap to navigate to diff viewer screen"
            >
              <Icon name="compare-arrows" size={32} color="primary" style={styles.shortcutIcon} />
              <Text variant="body-md" weight="bold" color="onSurface" style={styles.shortcutTitle}>
                Diff Viewer
              </Text>
              <Text variant="body-sm" color="onSurfaceVariant">
                Review code changes
              </Text>
            </Card>

            <Card
              variant="low"
              padding="lg"
              onPress={onNavigateToCompose}
              style={styles.shortcutCard}
              accessibilityLabel="Compose Prompt shortcut"
              accessibilityHint="Double tap to navigate to compose prompt screen"
            >
              <Icon name="terminal" size={32} color="secondary" style={styles.shortcutIcon} />
              <Text variant="body-md" weight="bold" color="onSurface" style={styles.shortcutTitle}>
                Compose Prompt
              </Text>
              <Text variant="body-sm" color="onSurfaceVariant">
                Send AI prompt
              </Text>
            </Card>
          </View>
        </View>

        {/* Recent Activity Section (Requirement 3.7, 15.3, 23.1) */}
        <View style={styles.section}>
          <Text variant="headline-md" weight="bold" color="onSurface" style={styles.sectionTitle}>
            Recent Activity
          </Text>

          {recentActivity.length > 0 ? (
            <Card variant="low" padding="lg" style={styles.activityCard}>
              <FlatList
                data={recentActivity}
                renderItem={renderActivityItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => (
                  <View
                    style={[styles.activityDivider, { borderColor: theme.colors.outlineVariant }]}
                  />
                )}
              />
            </Card>
          ) : (
            <Card variant="low" padding="lg" style={styles.emptyActivityCard}>
              <Icon name="history" size={48} color="onSurfaceVariant" />
              <Text
                variant="display-lg"
                weight="bold"
                color="onSurfaceVariant"
                align="center"
                style={styles.emptyStateHeadline}
              >
                No Recent Activity
              </Text>
              <Text
                variant="body-md"
                color="onSurfaceVariant"
                align="center"
                style={styles.emptyStateDescription}
              >
                Your recent commits, syncs, and deployments will appear here
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  errorContent: {
    flex: 1,
    gap: 4,
  },
  errorMessage: {
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100, // Space for bottom nav
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  bentoGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  bentoGridLarge: {
    flexDirection: 'row',
  },
  bentoCard: {
    flex: 1,
  },
  bentoCardLarge: {
    flex: 2,
  },
  bentoColumn: {
    gap: 12,
  },
  bentoColumnSmall: {
    flex: 1,
  },
  cardLabel: {
    marginBottom: 8,
  },
  cardDescription: {
    marginTop: 8,
  },
  largeMetric: {
    marginVertical: 8,
  },
  mediumMetric: {
    marginVertical: 4,
  },
  trafficCard: {
    marginTop: 12,
  },
  trafficRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  trafficColumn: {
    flex: 1,
  },
  trafficLabel: {
    marginBottom: 8,
  },
  trafficBar: {
    marginVertical: 8,
  },
  trafficValue: {
    marginTop: 4,
  },
  healthGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  healthCard: {
    flex: 1,
  },
  healthCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthCardText: {
    flex: 1,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  shortcutCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  shortcutIcon: {
    marginBottom: 12,
  },
  shortcutTitle: {
    marginBottom: 4,
    textAlign: 'center',
  },
  activityCard: {
    minHeight: 200,
  },
  emptyActivityCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateHeadline: {
    marginTop: 16,
  },
  emptyStateDescription: {
    marginTop: 8,
    maxWidth: 300,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  activityIcon: {
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTime: {
    marginTop: 4,
  },
  activityDivider: {
    height: 1,
    marginVertical: 8,
  },
});
