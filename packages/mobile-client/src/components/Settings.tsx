/**
 * Settings Screen Component
 *
 * Redesigned settings screen with connectivity status, configuration options,
 * and app information following the Obsidian UI design system.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignSystem } from '../design-system/theme/useDesignSystem';
import { Text } from '../design-system/typography/Text';
import { Card } from '../design-system/components/Card';
import { TextInput } from '../design-system/components/TextInput';
import { Toggle } from '../design-system/components/Toggle';
import { Icon } from '../design-system/components/Icon';
import { TopAppBar } from '../navigation/TopAppBar';
import { useConnection } from '../hooks/useConnection';
import { useConnectionQuality } from '../hooks/useConnectionQuality';

// AsyncStorage keys
const STORAGE_KEYS = {
  RELAY_SERVER_URL: '@codelink/relay_server_url',
  DARK_MODE: '@codelink/dark_mode',
  HIGH_CONTRAST: '@codelink/high_contrast',
  PUSH_NOTIFICATIONS: '@codelink/push_notifications',
  SOUND_EFFECTS: '@codelink/sound_effects',
};

// App version from package.json
const APP_VERSION = '0.1.0';

/**
 * Settings screen component
 */
export const Settings: React.FC = () => {
  const { theme, config, setConfig } = useDesignSystem();
  const { status } = useConnection();
  const { quality, latency } = useConnectionQuality();

  // State for settings
  const [relayServerUrl, setRelayServerUrl] = useState('http://localhost:8080');
  const [urlError, setUrlError] = useState<string | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(config.mode === 'dark');
  const [highContrast, setHighContrast] = useState(config.highContrast);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);

  /**
   * Load saved preferences on mount
   */
  useEffect(() => {
    loadPreferences();
  }, []);

  /**
   * Load preferences from AsyncStorage
   */
  const loadPreferences = async () => {
    try {
      const [
        savedUrl,
        savedDarkMode,
        savedHighContrast,
        savedPushNotifications,
        savedSoundEffects,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.RELAY_SERVER_URL),
        AsyncStorage.getItem(STORAGE_KEYS.DARK_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST),
        AsyncStorage.getItem(STORAGE_KEYS.PUSH_NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.SOUND_EFFECTS),
      ]);

      if (savedUrl) setRelayServerUrl(savedUrl);
      if (savedDarkMode !== null) setDarkMode(savedDarkMode === 'true');
      if (savedHighContrast !== null) setHighContrast(savedHighContrast === 'true');
      if (savedPushNotifications !== null) setPushNotifications(savedPushNotifications === 'true');
      if (savedSoundEffects !== null) setSoundEffects(savedSoundEffects === 'true');
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  /**
   * Validate URL format
   */
  const validateUrl = (url: string): boolean => {
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(url);
  };

  /**
   * Handle relay server URL change
   */
  const handleUrlChange = async (url: string) => {
    setRelayServerUrl(url);

    // Validate URL
    if (url && !validateUrl(url)) {
      const errorMsg = 'Invalid URL format. Must start with http:// or https://';
      setUrlError(errorMsg);
      // Log validation errors (Requirement 17.11)
      console.error('URL validation failed:', {
        error: errorMsg,
        providedUrl: url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setUrlError(undefined);

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RELAY_SERVER_URL, url);
    } catch (error) {
      console.error('Failed to save relay server URL:', error);
    }
  };

  /**
   * Handle dark mode toggle
   */
  const handleDarkModeChange = async (enabled: boolean) => {
    setDarkMode(enabled);

    // Update theme configuration
    setConfig({
      ...config,
      mode: enabled ? 'dark' : 'light',
    });

    // Also save to legacy AsyncStorage key for backwards compatibility
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DARK_MODE, String(enabled));
    } catch (error) {
      console.error('Failed to save dark mode preference:', error);
    }
  };

  /**
   * Handle high contrast toggle
   */
  const handleHighContrastChange = async (enabled: boolean) => {
    setHighContrast(enabled);

    // Update theme configuration
    setConfig({
      ...config,
      highContrast: enabled,
    });

    // Also save to legacy AsyncStorage key for backwards compatibility
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(enabled));
    } catch (error) {
      console.error('Failed to save high contrast preference:', error);
    }
  };

  /**
   * Handle push notifications toggle
   */
  const handlePushNotificationsChange = async (enabled: boolean) => {
    setPushNotifications(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_NOTIFICATIONS, String(enabled));
    } catch (error) {
      console.error('Failed to save push notifications preference:', error);
    }
  };

  /**
   * Handle sound effects toggle
   */
  const handleSoundEffectsChange = async (enabled: boolean) => {
    setSoundEffects(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SOUND_EFFECTS, String(enabled));
    } catch (error) {
      console.error('Failed to save sound effects preference:', error);
    }
  };

  /**
   * Open external link
   */
  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Failed to open URL:', err));
  };

  /**
   * Get connection status label
   */
  const getStatusLabel = (): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting';
    }
  };

  /**
   * Get quality label
   */
  const getQualityLabel = (): string => {
    switch (quality) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'fair':
        return 'Fair';
      case 'poor':
        return 'Poor';
      case 'offline':
        return 'Offline';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Top App Bar */}
      <TopAppBar connectionStatus={status} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
            <Text variant="headline-lg" weight="bold" color="onSurface">
              Settings
            </Text>
            <Text
              variant="body-md"
              color="onSurfaceVariant"
              style={{ marginTop: theme.spacing.xs }}
            >
              Configure your development environment
            </Text>
          </View>

          {/* Connectivity Bento Cards */}
          <View style={[styles.section, { paddingHorizontal: theme.spacing.lg }]}>
            <View style={styles.bentoGrid}>
              {/* Status Card */}
              <Card
                variant="low"
                padding="md"
                borderRadius="lg"
                style={[styles.bentoCard, styles.bentoCardSmall]}
              >
                <Text variant="label-sm" color="onSurfaceVariant" uppercase>
                  Status
                </Text>
                <Text
                  variant="title-lg"
                  weight="bold"
                  color={status === 'connected' ? 'secondary' : 'error'}
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {getStatusLabel()}
                </Text>
              </Card>

              {/* Latency Card */}
              <Card
                variant="low"
                padding="md"
                borderRadius="lg"
                style={[styles.bentoCard, styles.bentoCardSmall]}
              >
                <Text variant="label-sm" color="onSurfaceVariant" uppercase>
                  Latency
                </Text>
                <Text
                  variant="title-lg"
                  weight="bold"
                  color="onSurface"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {latency !== null ? `${latency}ms` : '--'}
                </Text>
              </Card>

              {/* Active Instance Card */}
              <Card
                variant="low"
                padding="md"
                borderRadius="lg"
                style={[styles.bentoCard, styles.bentoCardLarge]}
              >
                <Text variant="label-sm" color="onSurfaceVariant" uppercase>
                  Active Instance
                </Text>
                <Text
                  variant="title-md"
                  weight="semibold"
                  color="onSurface"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  localhost:8080
                </Text>
              </Card>

              {/* Load Card */}
              <Card
                variant="low"
                padding="md"
                borderRadius="lg"
                style={[styles.bentoCard, styles.bentoCardSmall]}
              >
                <Text variant="label-sm" color="onSurfaceVariant" uppercase>
                  Quality
                </Text>
                <Text
                  variant="title-lg"
                  weight="bold"
                  color="onSurface"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {getQualityLabel()}
                </Text>
              </Card>
            </View>
          </View>

          {/* Infrastructure Section */}
          <View style={[styles.section, { paddingHorizontal: theme.spacing.lg }]}>
            <Text
              variant="label-lg"
              color="onSurfaceVariant"
              uppercase
              style={{ marginBottom: theme.spacing.md }}
            >
              Infrastructure
            </Text>
            <Card variant="low" padding="lg" borderRadius="lg">
              <TextInput
                value={relayServerUrl}
                onChangeText={handleUrlChange}
                label="Relay Server URL"
                placeholder="http://localhost:8080"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                error={urlError}
              />
            </Card>
          </View>

          {/* Appearance Section */}
          <View style={[styles.section, { paddingHorizontal: theme.spacing.lg }]}>
            <Text
              variant="label-lg"
              color="onSurfaceVariant"
              uppercase
              style={{ marginBottom: theme.spacing.md }}
            >
              Appearance
            </Text>
            <Card variant="low" padding="lg" borderRadius="lg">
              <Toggle
                value={darkMode}
                onValueChange={handleDarkModeChange}
                label="Dark Mode"
                description="Use dark theme for the interface"
                hapticFeedback
              />
              <View style={{ height: theme.spacing.lg }} />
              <Toggle
                value={highContrast}
                onValueChange={handleHighContrastChange}
                label="High Contrast"
                description="Increase contrast for better visibility"
                hapticFeedback
              />
            </Card>
          </View>

          {/* Communication Section */}
          <View style={[styles.section, { paddingHorizontal: theme.spacing.lg }]}>
            <Text
              variant="label-lg"
              color="onSurfaceVariant"
              uppercase
              style={{ marginBottom: theme.spacing.md }}
            >
              Communication
            </Text>
            <Card variant="low" padding="lg" borderRadius="lg">
              <Toggle
                value={pushNotifications}
                onValueChange={handlePushNotificationsChange}
                label="Push Notifications"
                description="Receive notifications for important events"
                hapticFeedback
              />
              <View style={{ height: theme.spacing.lg }} />
              <Toggle
                value={soundEffects}
                onValueChange={handleSoundEffectsChange}
                label="Sound Effects"
                description="Play sounds for interactions"
                hapticFeedback
              />
            </Card>
          </View>

          {/* About Section */}
          <View style={[styles.section, { paddingHorizontal: theme.spacing.lg }]}>
            <Text
              variant="label-lg"
              color="onSurfaceVariant"
              uppercase
              style={{ marginBottom: theme.spacing.md }}
            >
              About
            </Text>
            <Card variant="low" padding="lg" borderRadius="lg">
              {/* App Icon and Version */}
              <View style={styles.aboutHeader}>
                <View
                  style={[
                    styles.appIcon,
                    {
                      backgroundColor: theme.colors.primaryContainer,
                      borderRadius: theme.borderRadius.lg,
                    },
                  ]}
                >
                  <Icon name="terminal" size={32} color="primary" />
                </View>
                <View style={{ marginLeft: theme.spacing.md }}>
                  <Text variant="title-lg" weight="bold" color="onSurface">
                    CodeLink
                  </Text>
                  <Text variant="body-sm" color="onSurfaceVariant">
                    Version {APP_VERSION}
                  </Text>
                </View>
              </View>

              {/* Links */}
              <View style={{ marginTop: theme.spacing.xl }}>
                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => openLink('https://github.com/codelink/docs')}
                  accessible={true}
                  accessibilityLabel="Open documentation"
                  accessibilityHint="Opens documentation in browser"
                  accessibilityRole="link"
                >
                  <Icon name="help" size={20} color="onSurface" />
                  <Text
                    variant="body-md"
                    color="onSurface"
                    style={{ marginLeft: theme.spacing.md }}
                  >
                    Documentation
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => openLink('https://github.com/codelink/support')}
                  accessible={true}
                  accessibilityLabel="Open support"
                  accessibilityHint="Opens support page in browser"
                  accessibilityRole="link"
                >
                  <Icon name="info" size={20} color="onSurface" />
                  <Text
                    variant="body-md"
                    color="onSurface"
                    style={{ marginLeft: theme.spacing.md }}
                  >
                    Support
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => openLink('https://github.com/codelink')}
                  accessible={true}
                  accessibilityLabel="Open GitHub repository"
                  accessibilityHint="Opens GitHub repository in browser"
                  accessibilityRole="link"
                >
                  <Icon name="code" size={20} color="onSurface" />
                  <Text
                    variant="body-md"
                    color="onSurface"
                    style={{ marginLeft: theme.spacing.md }}
                  >
                    GitHub
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>

          {/* Bottom padding for safe area */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  section: {
    marginTop: 24,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoCard: {
    minHeight: 80,
  },
  bentoCardSmall: {
    flex: 1,
    minWidth: '30%',
  },
  bentoCardLarge: {
    flex: 2,
    minWidth: '60%',
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
  },
});
