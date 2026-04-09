/**
 * Top App Bar Component
 *
 * Implements the top app bar with CodeLink branding and connection status indicator.
 * Features sticky positioning, connection status colors, and pulse animation for connecting state.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignSystem } from '../design-system';
import { Text } from '../design-system/typography/Text';
import { Icon } from '../design-system/components/Icon';
import { StatusIndicator, ConnectionStatus } from '../design-system/components/StatusIndicator';

/**
 * TopAppBar props
 */
export interface TopAppBarProps {
  /**
   * Current connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Show back button (optional, for future use)
   */
  showBackButton?: boolean;

  /**
   * Back button press handler (optional, for future use)
   */
  onBackPress?: () => void;
}

/**
 * TopAppBar component with branding and connection status
 *
 * Features:
 * - Terminal icon in primary color (#95ccff)
 * - "CodeLink" text in Manrope font
 * - Connection status indicator on right side
 * - Surface background color (#131313)
 * - Sticky positioning at top during scrolling
 * - Connection status colors (green for connected, red for disconnected)
 * - Pulse animation for connecting state
 *
 * Requirements: 9.1-9.8
 */
export const TopAppBar: React.FC<TopAppBarProps> = ({
  connectionStatus,
  showBackButton: _showBackButton = false,
  onBackPress: _onBackPress,
}) => {
  const { theme } = useDesignSystem();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface, // #131313
          paddingTop: insets.top || 8, // Safe area padding for status bar
        },
      ]}
    >
      <View style={styles.content}>
        {/* Left section: Branding */}
        <View style={styles.branding}>
          {/* Terminal icon in primary color */}
          <Icon
            name="terminal"
            size={24}
            color="primary" // #95ccff
            style={styles.brandIcon}
          />

          {/* CodeLink text in Manrope font */}
          <Text variant="title-lg" weight="bold" color="onSurface" style={styles.brandText}>
            CodeLink
          </Text>
        </View>

        {/* Right section: Connection status */}
        <View style={styles.statusContainer}>
          <StatusIndicator status={connectionStatus} showLabel={true} size="md" animated={true} />
        </View>
      </View>
    </View>
  );
};

/**
 * Styles for TopAppBar
 * Requirements: 9.4, 9.5
 */
const styles = StyleSheet.create({
  container: {
    // Sticky at top during scrolling
    position: 'relative',
    zIndex: 100,
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56, // Standard app bar height
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    marginRight: 8,
  },
  brandText: {
    // Manrope font applied via Text component
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
