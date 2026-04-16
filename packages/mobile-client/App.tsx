import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, BottomNavigation, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { InjectPromptResponse } from '@codelink/protocol';

// Components
import {
  Dashboard,
  PromptComposer,
  PromptResponseDisplay,
  DiffViewer,
  ErrorBoundary,
  EmptyState,
  Settings,
  AppLoading,
} from './src/components';

// Services
import { PromptManagerImpl, DiffMessageHandler } from './src/services';
import type { DiffState } from './src/services';

// Hooks
import {
  ConnectionStatusProvider,
  useConnection,
  ThemeProvider,
  useTheme,
  usePromptHistory,
  useScreenReaderAnnouncement,
} from './src/hooks';

// Config
import {
  getConfig,
  loadRelayServerUrlOverride,
  saveRelayServerUrlOverride,
  updateConfig,
} from './src/config';

// Design System
import { useCustomFonts } from './src/design-system/typography/fontLoading';

// Utils
import { isInjectPromptResponse, isSyncFullContextMessage } from './src/utils/messageValidation';
import {
  getStatusBarStyle,
  registerBackButtonHandler,
  isAndroid,
  triggerHapticFeedback,
} from './src/utils/platformAdaptations';

/**
 * Main application content with navigation
 */
interface AppContentProps {
  relayServerUrl: string;
  onRelayServerUrlChange: (url: string) => Promise<void>;
}

const AppContent: React.FC<AppContentProps> = ({ relayServerUrl, onRelayServerUrlChange }) => {
  const { status, error, socketManager, reconnect } = useConnection();
  const { theme, isDark } = useTheme();
  const { updateHistoryItem } = usePromptHistory();
  const { announce } = useScreenReaderAnnouncement();
  const [index, setIndex] = useState(0);
  const [promptResponse, setPromptResponse] = useState<InjectPromptResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<DiffState>({
    currentDiff: null,
    history: [],
    selectedIndex: -1,
  });

  // Initialize PromptManager and DiffMessageHandler
  const [promptManager] = useState(() => new PromptManagerImpl(socketManager));
  const [diffHandler] = useState(() => new DiffMessageHandler(50));

  // Set up message routing from SocketManager to handlers
  useEffect(() => {
    console.log('[App] Setting up message routing and handlers');

    // Handle incoming messages
    const messageHandler = (message: unknown) => {
      console.log('[App] Received message:', message);

      // Route INJECT_PROMPT_RESPONSE to PromptManager
      if (isInjectPromptResponse(message)) {
        console.log('[App] Routing INJECT_PROMPT_RESPONSE to PromptManager');
        promptManager.handleResponse(message);
      }

      // Route SYNC_FULL_CONTEXT to DiffMessageHandler
      if (isSyncFullContextMessage(message)) {
        console.log('[App] Routing SYNC_FULL_CONTEXT to DiffMessageHandler');
        const handled = diffHandler.handleMessage(message);
        console.log('[App] DiffMessageHandler.handleMessage returned:', handled);
      }
    };

    socketManager.onMessage(messageHandler);

    // Set up PromptManager response callback
    promptManager.onResponse((response) => {
      setPromptResponse(response);
      setIsSubmitting(false);

      // Update history with result
      if (currentPromptId) {
        updateHistoryItem(currentPromptId, {
          success: response.payload.success,
          editorUsed: response.payload.editorUsed,
        });
      }

      // Haptic feedback (Requirements 22.3, 22.4)
      if (response.payload.success) {
        triggerHapticFeedback('success');
      } else {
        triggerHapticFeedback('error');
      }

      // Clear response after 4 seconds
      setTimeout(() => {
        setPromptResponse(null);
      }, 4000);
    });

    // Set up DiffMessageHandler state change listener with functional state update
    diffHandler.onStateChange((state) => {
      console.log('[App] DiffMessageHandler state changed:', state);
      // Use functional state update to avoid stale closure issues
      setDiffState(() => {
        console.log('[App] Updating diffState with new state');
        return state;
      });
    });

    // Set up DiffMessageHandler error listener
    diffHandler.onError((error) => {
      console.error('[App] Diff handler error:', error);
    });

    console.log('[App] Message routing and handlers setup complete');
  }, [socketManager, promptManager, diffHandler, currentPromptId, updateHistoryItem]);

  // Handle prompt submission
  const handlePromptSubmit = (prompt: string) => {
    try {
      setIsSubmitting(true);
      setPromptError(null);
      const promptId = Date.now().toString();
      setCurrentPromptId(promptId);
      promptManager.submitPrompt(prompt);
    } catch (error) {
      setIsSubmitting(false);
      setPromptError(error instanceof Error ? error.message : 'Failed to submit prompt');
      triggerHapticFeedback('error');
    }
  };

  // Handle reconnection (currently unused but kept for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleReconnect = async () => {
    await triggerHapticFeedback('medium');
    reconnect();
  };

  // Handle Android hardware back button
  // Requirement 26.7: Android hardware back button support
  useEffect(() => {
    if (!isAndroid()) return;

    const backHandler = () => {
      // If not on dashboard, go back to dashboard
      if (index !== 0) {
        setIndex(0);
        return true; // Prevent default back behavior
      }
      // If on dashboard, allow default behavior (exit app)
      return false;
    };

    const cleanup = registerBackButtonHandler(backHandler);
    return cleanup;
  }, [index]);

  // Define navigation routes
  const [routes] = useState([
    {
      key: 'dashboard',
      title: 'Dashboard',
      focusedIcon: 'view-dashboard',
      unfocusedIcon: 'view-dashboard-outline',
    },
    {
      key: 'prompt',
      title: 'Prompt',
      focusedIcon: 'message-text',
      unfocusedIcon: 'message-text-outline',
    },
    { key: 'diff', title: 'Diff', focusedIcon: 'file-compare', unfocusedIcon: 'file-compare' },
    { key: 'settings', title: 'Settings', focusedIcon: 'cog', unfocusedIcon: 'cog-outline' },
  ]);

  // Announce screen changes for accessibility
  // Requirement 14.11: Announce screen changes on navigation
  useEffect(() => {
    const currentRoute = routes[index];
    if (currentRoute) {
      announce(`${currentRoute.title} screen`, 300);
    }
  }, [index, routes, announce]);

  // Render scene based on route
  const DashboardScene: React.FC = () => (
    <View style={styles.scene}>
      <Dashboard
        connectionStatus={status}
        connectionError={error}
        onRetry={reconnect}
        onNavigateToCompose={() => setIndex(1)}
        onNavigateToDiffs={() => setIndex(2)}
        onRefresh={async () => {
          await triggerHapticFeedback('light');
        }}
      />
    </View>
  );

  const PromptScene: React.FC = () => (
    <View style={styles.scene}>
      <PromptComposer onSubmit={handlePromptSubmit} isLoading={isSubmitting} error={promptError} />
      <PromptResponseDisplay response={promptResponse} connectionStatus={status} />
    </View>
  );

  const DiffScene: React.FC = () => (
    <View style={styles.scene}>
      {diffState.currentDiff ? (
        <DiffViewer payload={diffState.currentDiff} />
      ) : (
        <EmptyState
          icon="file-document-outline"
          title="No Diffs Available"
          description="Diffs will appear here when files are synced from your editor"
          actionLabel="Go to Dashboard"
          onAction={() => setIndex(0)}
        />
      )}
    </View>
  );

  const SettingsScene: React.FC = () => (
    <View style={styles.scene}>
      <Settings relayServerUrl={relayServerUrl} onRelayServerUrlChange={onRelayServerUrlChange} />
    </View>
  );

  const renderScene = BottomNavigation.SceneMap({
    dashboard: DashboardScene,
    prompt: PromptScene,
    diff: DiffScene,
    settings: SettingsScene,
  });

  // Render icon with badge
  const renderIcon = ({
    route,
    focused,
    color,
  }: {
    route: { key: string; focusedIcon: string; unfocusedIcon: string };
    focused: boolean;
    color: string;
  }) => {
    const icon = (focused ? route.focusedIcon : route.unfocusedIcon) as React.ComponentProps<
      typeof MaterialCommunityIcons
    >['name'];

    // Show badge on diff tab if there are new diffs
    if (route.key === 'diff' && diffState.history.length > 0) {
      return (
        <View>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
          <Badge size={8} style={styles.badge} />
        </View>
      );
    }

    return <MaterialCommunityIcons name={icon} size={24} color={color} />;
  };

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <BottomNavigation
          navigationState={{ index, routes }}
          onIndexChange={setIndex}
          renderScene={renderScene}
          renderIcon={renderIcon}
          barStyle={{ backgroundColor: theme.colors.surface }}
        />
        <StatusBar style={getStatusBarStyle(isDark)} />
      </View>
    </SafeAreaProvider>
  );
};

/**
 * Root App component with providers
 */
export default function App() {
  const config = getConfig();
  const [relayServerUrl, setRelayServerUrl] = useState(config.relayServerUrl);
  const [isRelayConfigLoading, setIsRelayConfigLoading] = useState(true);

  // Load custom fonts
  const { fontsLoaded, fontError } = useCustomFonts();

  useEffect(() => {
    loadRelayServerUrlOverride()
      .then((savedRelayServerUrl) => {
        if (savedRelayServerUrl) {
          updateConfig({ relayServerUrl: savedRelayServerUrl });
          setRelayServerUrl(savedRelayServerUrl);
        }
      })
      .finally(() => {
        setIsRelayConfigLoading(false);
      });
  }, []);

  const handleRelayServerUrlChange = async (nextRelayServerUrl: string) => {
    await saveRelayServerUrlOverride(nextRelayServerUrl);
    updateConfig({ relayServerUrl: nextRelayServerUrl });
    setRelayServerUrl(nextRelayServerUrl);
  };

  // Show loading screen while fonts are loading
  if (!fontsLoaded || isRelayConfigLoading) {
    return <AppLoading message="Loading fonts..." />;
  }

  // Log font loading error but continue with system fonts
  if (fontError) {
    console.error('Font loading failed, using system fonts:', fontError);
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PaperProvider>
          <ConnectionStatusProvider serverUrl={relayServerUrl}>
            <AppContent
              relayServerUrl={relayServerUrl}
              onRelayServerUrlChange={handleRelayServerUrlChange}
            />
          </ConnectionStatusProvider>
        </PaperProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scene: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
