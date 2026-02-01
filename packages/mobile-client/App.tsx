import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme, BottomNavigation } from 'react-native-paper';
import type { InjectPromptResponse } from '@codelink/protocol';

// Components
import {
  Dashboard,
  PromptComposer,
  PromptResponseDisplay,
  DiffViewer,
  ErrorBoundary
} from './src/components';

// Services
import { PromptManagerImpl, DiffMessageHandler } from './src/services';
import type { DiffState } from './src/services';

// Hooks
import { ConnectionStatusProvider, useConnection } from './src/hooks';

// Utils
import { isInjectPromptResponse, isSyncFullContextMessage } from './src/utils/messageValidation';

/**
 * Custom theme configuration for React Native Paper
 */
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6200ee',
    secondary: '#03dac6',
    error: '#b00020',
  },
};

/**
 * Main application content with navigation
 */
const AppContent: React.FC = () => {
  const { status, socketManager } = useConnection();
  const [index, setIndex] = useState(0);
  const [promptResponse, setPromptResponse] = useState<InjectPromptResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
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
  }, [socketManager, promptManager, diffHandler]);

  // Handle prompt submission
  const handlePromptSubmit = (prompt: string) => {
    try {
      setIsSubmitting(true);
      setPromptError(null);
      promptManager.submitPrompt(prompt);
    } catch (error) {
      setIsSubmitting(false);
      setPromptError(error instanceof Error ? error.message : 'Failed to submit prompt');
    }
  };

  // Handle response dismissal
  const handleResponseDismiss = () => {
    setPromptResponse(null);
  };

  // Define navigation routes
  const [routes] = useState([
    { key: 'dashboard', title: 'Dashboard', focusedIcon: 'view-dashboard' },
    { key: 'prompt', title: 'Prompt', focusedIcon: 'message-text' },
    { key: 'diff', title: 'Diff', focusedIcon: 'file-compare' },
  ]);

  // Render scene based on route
  const renderScene = BottomNavigation.SceneMap({
    dashboard: () => (
      <View style={styles.scene}>
        <Dashboard
          connectionStatus={status}
          onNavigateToPrompts={() => setIndex(1)}
          onNavigateToDiffs={() => setIndex(2)}
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
          <View style={styles.emptyState}>
            <PromptComposer
              onSubmit={() => {}}
              isLoading={false}
              error={null}
            />
          </View>
        )}
      </View>
    ),
  });

  return (
    <SafeAreaView style={styles.container}>
      <BottomNavigation
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderScene={renderScene}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
};

/**
 * Root App component with providers
 */
export default function App() {
  return (
    <ErrorBoundary>
      <PaperProvider theme={theme}>
        <ConnectionStatusProvider>
          <AppContent />
        </ConnectionStatusProvider>
      </PaperProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scene: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
