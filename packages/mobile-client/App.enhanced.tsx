import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { Provider as PaperProvider, BottomNavigation, Badge } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import type { InjectPromptResponse } from '@codelink/protocol';

// Components
import {
  Dashboard,
  PromptComposer,
  PromptResponseDisplay,
  DiffViewer,
  ErrorBoundary,
  EmptyState,
  Settings
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
  usePromptHistory
} from './src/hooks';

// Config
import { getConfig } from './src/config';

// Utils
import { isInjectPromptResponse, isSyncFullContextMessage } from './src/utils/messageValidation';

/**
 * Main application content with navigation
 */
const AppContent: React.FC = () => {
  const { status, socketManager, reconnect } = useConnection();
  const { theme, isDark } = useTheme();
  const { updateHistoryItem } = usePromptHistory();
  const [index, setIndex] = useState(0);
  const [promptResponse, setPromptResponse] = useState<InjectPromptResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<DiffState>({
    currentDiff: null,
    history: [],
    selectedIndex: -1
  });

  // Initialize PromptManager and DiffMessageHandler
  const [promptManager] = useState(() => new PromptManagerImpl(socketManager));
  const [diffHandler] = useState(() => new DiffMessageHandler(50));

  // Set up message routing from SocketManager to handlers
  useEffect(() => {
    // Handle incoming messages
    const messageHandler = (message: unknown) => {
      // Route INJECT_PROMPT_RESPONSE to PromptManager
      if (isInjectPromptResponse(message)) {
        promptManager.handleResponse(message);
      }
      
      // Route SYNC_FULL_CONTEXT to DiffMessageHandler
      if (isSyncFullContextMessage(message)) {
        diffHandler.handleMessage(message);
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
      
      // Haptic feedback
      if (response.payload.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      // Clear response after 4 seconds
      setTimeout(() => {
        setPromptResponse(null);
      }, 4000);
    });

    // Set up DiffMessageHandler state change listener
    diffHandler.onStateChange((state) => {
      setDiffState(state);
    });

    // Set up DiffMessageHandler error listener
    diffHandler.onError((error) => {
      console.error('Diff handler error:', error);
    });
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Handle response dismissal
  const handleResponseDismiss = () => {
    setPromptResponse(null);
  };

  // Handle reconnection
  const handleReconnect = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reconnect();
  };

  // Define navigation routes
  const [routes] = useState([
    { key: 'dashboard', title: 'Dashboard', focusedIcon: 'view-dashboard', unfocusedIcon: 'view-dashboard-outline' },
    { key: 'prompt', title: 'Prompt', focusedIcon: 'message-text', unfocusedIcon: 'message-text-outline' },
    { key: 'diff', title: 'Diff', focusedIcon: 'file-compare', unfocusedIcon: 'file-compare' },
    { key: 'settings', title: 'Settings', focusedIcon: 'cog', unfocusedIcon: 'cog-outline' },
  ]);

  // Render scene based on route
  const renderScene = BottomNavigation.SceneMap({
    dashboard: () => (
      <View style={styles.scene}>
        <Dashboard
          connectionStatus={status}
          onNavigateToPrompts={() => setIndex(1)}
          onNavigateToDiffs={() => setIndex(2)}
          onReconnect={handleReconnect}
          pendingPromptsCount={0}
          recentDiffsCount={diffState.history.length}
          lastSyncTime={diffState.history.length > 0 ? new Date() : null}
        />
      </View>
    ),
    prompt: () => (
      <View style={styles.scene}>
        <PromptComposer
          onSubmit={handlePromptSubmit}
          isLoading={isSubmitting}
          error={promptError}
        />
        <PromptResponseDisplay
          response={promptResponse}
          onDismiss={handleResponseDismiss}
        />
      </View>
    ),
    diff: () => (
      <View style={styles.scene}>
        {diffState.currentDiff ? (
          <DiffViewer
            payload={diffState.currentDiff}
          />
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
    ),
    settings: () => (
      <View style={styles.scene}>
        <Settings />
      </View>
    ),
  });

  // Render icon with badge
  const renderIcon = ({ route, focused, color }: any) => {
    const icon = focused ? route.focusedIcon : route.unfocusedIcon;
    
    // Show badge on diff tab if there are new diffs
    if (route.key === 'diff' && diffState.history.length > 0) {
      return (
        <View>
          <BottomNavigation.Icon icon={icon} color={color} />
          <Badge size={8} style={styles.badge} />
        </View>
      );
    }
    
    return <BottomNavigation.Icon icon={icon} color={color} />;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <BottomNavigation
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderScene={renderScene}
        renderIcon={renderIcon}
        barStyle={{ backgroundColor: theme.colors.surface }}
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaView>
  );
};

/**
 * Root App component with providers
 */
export default function App() {
  const config = getConfig();
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PaperProvider>
          <ConnectionStatusProvider serverUrl={config.relayServerUrl}>
            <AppContent />
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
