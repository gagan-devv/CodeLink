import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTerminalStore } from '../../src/terminal/useTerminalStore';
import { TerminalTabBar } from '../../src/terminal/TerminalTabBar';
import { TerminalView } from '../../src/terminal/TerminalView';
import { wsManager } from '../../src/ws/WsManager';
import { useSessionStore } from '../../src/store/useSessionStore';

export default function TerminalScreen() {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const isConnected = useSessionStore((s) => s.status === 'connected');

  // Request session list on mount or connect
  useEffect(() => {
    if (isConnected) {
      wsManager.sendTerminal('TERM_ATTACH', {
        sessionId: '',
        requestedMode: 'observe',
      });
    }
  }, [isConnected]);

  const handleCreateSession = () => {
    const nextIndex = sessions.length + 1;
    wsManager.sendTerminal('TERM_NEW_SESSION', {
      title: `Terminal ${nextIndex}`,
      cols: 80,
      rows: 24,
    });
  };

  const handleCloseSession = (sessionId: string) => {
    wsManager.sendTerminal('TERM_CLOSE_SESSION', { sessionId });
  };

  const handleSendInput = (data: string) => {
    if (!activeSessionId) return;
    const inputId = `in-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    wsManager.sendTerminal('TERM_INPUT', {
      sessionId: activeSessionId,
      inputId,
      generation: 0,
      data,
    });
  };

  const handleRequestMode = (mode: 'observe' | 'control') => {
    if (!activeSessionId) return;
    wsManager.sendTerminal('TERM_ATTACH', {
      sessionId: activeSessionId,
      requestedMode: mode,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Multi-Session Tabs */}
        <TerminalTabBar
          onCreateSession={handleCreateSession}
          onCloseSession={handleCloseSession}
          disabled={!isConnected || sessions.length >= 8}
        />

        {/* Active Terminal or Empty State */}
        {activeSessionId ? (
          <TerminalView
            sessionId={activeSessionId}
            onSendInput={handleSendInput}
            onRequestMode={handleRequestMode}
            isConnected={isConnected}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Managed Remote Terminal</Text>
            <Text style={styles.emptySubtitle}>
              Access a real PTY shell running as your user on the Linux host with end-to-end
              encryption.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, !isConnected && styles.createBtnDisabled]}
              onPress={handleCreateSession}
              disabled={!isConnected}
              activeOpacity={0.7}
            >
              <Text style={styles.createBtnText}>
                {isConnected ? '+ Launch Terminal Shell' : 'Connect to Host First'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.safetyDisclaimer}>
              Security note: Commands run with full host user permissions. Terminal sessions persist
              even when disconnected.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#a0a0a0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 380,
  },
  createBtn: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  createBtnDisabled: {
    backgroundColor: '#3a3a3a',
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  safetyDisclaimer: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 16,
  },
});
