import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useTerminalStore } from '../../src/terminal/useTerminalStore';
import { TerminalTabBar } from '../../src/terminal/TerminalTabBar';
import { TerminalView } from '../../src/terminal/TerminalView';
import { wsManager } from '../../src/ws/WsManager';
import { useSessionStore } from '../../src/store/useSessionStore';
import { MobilePairingService } from '../../src/crypto/MobilePairingService';
import { isTerminalFeatureFlagEnabled } from '../../src/terminal/terminalGating';

export default function TerminalScreen() {
  const isTerminalEnabled = isTerminalFeatureFlagEnabled();
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const isConnected = useSessionStore((s) => s.status === 'connected');

  const e2eeState = useTerminalStore((s) => s.e2eeState);
  const e2eeSession = useTerminalStore((s) => s.e2eeSession);
  const e2eeError = useTerminalStore((s) => s.e2eeError);
  const sasCode = useTerminalStore((s) => s.sasCode);
  const sessionToken = useTerminalStore((s) => s.sessionToken);

  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [showPairingInput, setShowPairingInput] = useState(false);

  // Restore paired session on mount
  useEffect(() => {
    MobilePairingService.restoreSessionIfPaired();
  }, []);

  // Poll pairing approval status when pending approval
  useEffect(() => {
    if (e2eeState === 'pending_approval' && sessionToken && isConnected) {
      const interval = setInterval(() => {
        wsManager.sendTerminal('TERM_PAIR_STATUS', { sessionToken });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [e2eeState, sessionToken, isConnected]);

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
    useTerminalStore.getState().sendEncryptedInput(activeSessionId, data);
  };

  const handleRequestMode = (mode: 'observe' | 'control') => {
    if (!activeSessionId) return;
    wsManager.sendTerminal('TERM_ATTACH', {
      sessionId: activeSessionId,
      requestedMode: mode,
    });
  };

  const handleInitiatePairing = async () => {
    if (!pairingCodeInput.trim()) return;
    await MobilePairingService.initiatePairing(pairingCodeInput.trim());
    setPairingCodeInput('');
  };

  const handleDismissError = () => {
    useTerminalStore.getState().setE2EEError(null);
  };

  if (!isTerminalEnabled) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Terminal Disabled</Text>
          <Text style={styles.emptySubtitle}>
            Remote terminal shell access is currently disabled. Set
            EXPO_PUBLIC_TERMINAL_ENABLED=true in your environment to enable it.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* E2EE Error Banner */}
        {e2eeError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{e2eeError}</Text>
            <TouchableOpacity onPress={handleDismissError} style={styles.errorDismissBtn}>
              <Text style={styles.errorDismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* E2EE Pending Approval SAS Banner */}
        {e2eeState === 'pending_approval' && sasCode ? (
          <View style={styles.sasBanner}>
            <Text style={styles.sasTitle}>Pairing Verification SAS</Text>
            <Text style={styles.sasCode}>{sasCode}</Text>
            <Text style={styles.sasInstructions}>
              Verify this code matches on your laptop companion and approve on host.
            </Text>
            <ActivityIndicator size="small" color="#0078d4" style={{ marginTop: 8 }} />
          </View>
        ) : null}

        {/* E2EE Initiating Banner */}
        {e2eeState === 'initiating' ? (
          <View style={styles.initiatingBanner}>
            <ActivityIndicator size="small" color="#0078d4" />
            <Text style={styles.initiatingText}>Verifying pairing code with host companion...</Text>
          </View>
        ) : null}

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

            {/* E2EE Status indicator */}
            <View style={styles.e2eeStatusBox}>
              <Text style={styles.e2eeStatusLabel}>
                E2EE Status:{' '}
                <Text
                  style={{
                    color: e2eeSession ? '#4ec9b0' : '#ce9178',
                    fontWeight: 'bold',
                  }}
                >
                  {e2eeSession ? 'Secure (E2EE Active)' : 'Unpaired'}
                </Text>
              </Text>
            </View>

            {!e2eeSession && showPairingInput ? (
              <View style={styles.pairingInputContainer}>
                <TextInput
                  style={styles.pairingInput}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={pairingCodeInput}
                  onChangeText={setPairingCodeInput}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.pairSubmitBtn, !isConnected && styles.createBtnDisabled]}
                  onPress={handleInitiatePairing}
                  disabled={!isConnected}
                >
                  <Text style={styles.pairSubmitBtnText}>Pair</Text>
                </TouchableOpacity>
              </View>
            ) : !e2eeSession ? (
              <TouchableOpacity
                style={styles.pairBtn}
                onPress={() => setShowPairingInput(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.pairBtnText}>Pair with Laptop Companion</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.createBtn, (!isConnected || !e2eeSession) && styles.createBtnDisabled]}
              onPress={handleCreateSession}
              disabled={!isConnected || !e2eeSession}
              activeOpacity={0.7}
            >
              <Text style={styles.createBtnText}>
                {!isConnected
                  ? 'Connect to Host First'
                  : !e2eeSession
                    ? 'Pair Device First'
                    : '+ Launch Terminal Shell'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.safetyDisclaimer}>
              Security note: Commands run with full host user permissions. Terminal sessions persist
              even when disconnected. Plaintext transmission without E2EE is strictly refused.
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
  errorBanner: {
    backgroundColor: '#441818',
    borderColor: '#d16969',
    borderWidth: 1,
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#f48771',
    fontSize: 13,
    flex: 1,
  },
  errorDismissBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  errorDismissText: {
    color: '#f48771',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sasBanner: {
    backgroundColor: '#1b2d42',
    borderColor: '#0078d4',
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  sasTitle: {
    color: '#80c4ff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  sasCode: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
    marginVertical: 4,
  },
  sasInstructions: {
    color: '#cccccc',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  initiatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#161b22',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
    gap: 8,
  },
  initiatingText: {
    color: '#8b949e',
    fontSize: 13,
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
    marginBottom: 16,
    maxWidth: 380,
  },
  e2eeStatusBox: {
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  e2eeStatusLabel: {
    color: '#cccccc',
    fontSize: 13,
  },
  pairingInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  pairingInput: {
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    borderColor: '#3a3a3a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 16,
    letterSpacing: 2,
    width: 160,
    textAlign: 'center',
  },
  pairSubmitBtn: {
    backgroundColor: '#238636',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pairSubmitBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  pairBtn: {
    borderColor: '#0078d4',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  pairBtnText: {
    color: '#0078d4',
    fontSize: 14,
    fontWeight: '600',
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
