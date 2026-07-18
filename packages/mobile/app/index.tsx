import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getStoredSession } from '../src/api/authClient';
import { wsManager } from '../src/ws/WsManager';
import { handleMessage } from '../src/ws/MessageDispatcher';
import { useSessionStore } from '../src/store/useSessionStore';

export default function Index() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Check stored session on mount
  useEffect(() => {
    wsManager.onMessage = handleMessage;
    wsManager.onConnected = () => useSessionStore.getState().setConnected('restored');
    wsManager.onDisconnected = () => {};

    getStoredSession().then((session) => {
      if (session) {
        useSessionStore.getState().setConnecting();
        wsManager.connect(session.relayWss, session.mobileToken);
        router.replace('/(tabs)');
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  // Blinking terminal cursor simulation
  useEffect(() => {
    if (checkingSession) return;
    const interval = setInterval(() => {
      setCursorVisible((v: boolean) => !v);
    }, 600);
    return () => clearInterval(interval);
  }, [checkingSession]);

  const handleGetStarted = () => {
    router.push('/pairing');
  };

  if (checkingSession) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator size="large" color="#0078d4" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scrollContent} style={s.scrollView}>
        <View style={s.contentWrapper}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLogoContainer}>
              <Text style={s.headerLogoSymbol}>⚡</Text>
              <Text style={s.headerTitle}>CodeLink</Text>
            </View>
            <Text style={s.headerHelp}>?</Text>
          </View>

          {/* Hero Section */}
          <View style={s.heroSection}>
            <Text style={s.heroTitle}>
              Seamless Developer{'\n'}
              <Text style={s.heroAccent}>Synchronization</Text>
            </Text>
            <Text style={s.heroDesc}>
              Pair your mobile device with VS Code to view live file diffs, active cursor lines, and
              send prompts directly to the AI assistant in your editor.
            </Text>
          </View>

          {/* Mock Terminal Card */}
          <View style={s.mockTerminal}>
            <View style={s.terminalHeader}>
              <View style={s.terminalTitleContainer}>
                <Text style={s.terminalIcon}>📄</Text>
                <Text style={s.terminalTitle}>main.ts — CodeLink</Text>
              </View>
              <View style={s.windowButtons}>
                <View style={[s.winBtn, { backgroundColor: '#ff5f56' }]} />
                <View style={[s.winBtn, { backgroundColor: '#ffbd2e' }]} />
                <View style={[s.winBtn, { backgroundColor: '#27c93f' }]} />
              </View>
            </View>

            <View style={s.terminalBody}>
              <View style={s.codeLine}>
                <Text style={s.codeLineNumber}>12 </Text>
                <Text style={s.codeText}>class CodeRelay {'{'}</Text>
              </View>
              <View style={[s.codeLine, s.codeLineAdded]}>
                <Text style={[s.codeLineNumber, s.codeLineNumberAdded]}>13 </Text>
                <Text style={s.codeTextAdded}>+ private socket: WebSocket;</Text>
              </View>
              <View style={s.codeLine}>
                <Text style={s.codeLineNumber}>14 </Text>
                <Text style={s.codeText}> constructor() {'{'}</Text>
              </View>
              <View style={s.codeLine}>
                <Text style={s.codeLineNumber}>15 </Text>
                <Text style={s.codeText}> </Text>
                {cursorVisible ? (
                  <View style={s.terminalCursor} />
                ) : (
                  <View style={[s.terminalCursor, { backgroundColor: 'transparent' }]} />
                )}
              </View>
            </View>

            <View style={s.activeBadge}>
              <View style={s.glowingDot} />
              <Text style={s.activeBadgeText}>ACTIVE LINK</Text>
            </View>
          </View>

          {/* Key Capabilities */}
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>KEY CAPABILITIES</Text>
          </View>

          <View style={s.cardGrid}>
            <View style={s.capabilityCard}>
              <View style={s.capabilityIconContainer}>
                <Text style={s.capabilityEmoji}>🔄</Text>
              </View>
              <View style={s.capabilityTextContainer}>
                <Text style={s.capabilityTitle}>Live Diff Viewer</Text>
                <Text style={s.capabilityDesc}>
                  Real-time code stream directly from your VS Code buffer as you edit.
                </Text>
              </View>
            </View>

            <View style={s.capabilityCard}>
              <View style={s.capabilityIconContainer}>
                <Text style={s.capabilityEmoji}>⌨️</Text>
              </View>
              <View style={s.capabilityTextContainer}>
                <Text style={s.capabilityTitle}>AI Prompt Composer</Text>
                <Text style={s.capabilityDesc}>
                  Voice or text instructions sent from your phone to your desktop's AI assistant.
                </Text>
              </View>
            </View>

            <View style={s.capabilityCard}>
              <View style={s.capabilityIconContainer}>
                <Text style={s.capabilityEmoji}>🔗</Text>
              </View>
              <View style={s.capabilityTextContainer}>
                <Text style={s.capabilityTitle}>Instant Pairing</Text>
                <Text style={s.capabilityDesc}>
                  Secure peer-to-peer WebSocket relay with end-to-end encryption.
                </Text>
              </View>
            </View>
          </View>

          {/* How to Connect */}
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderBar} />
            <Text style={s.sectionTitle}>GETTING CONNECTED</Text>
          </View>

          <View style={s.stepsContainer}>
            <View style={s.stepRow}>
              <View style={s.stepIndicatorContainer}>
                <View style={s.stepNumberBubbleActive}>
                  <Text style={s.stepNumberActive}>1</Text>
                </View>
                <View style={s.stepConnectorLine} />
              </View>
              <View style={s.stepContent}>
                <Text style={s.stepTitle}>Extension Setup</Text>
                <Text style={s.stepDesc}>
                  Install the <Text style={s.monospaceText}>CodeLink</Text> VS Code extension from
                  the Marketplace.
                </Text>
              </View>
            </View>

            <View style={s.stepRow}>
              <View style={s.stepIndicatorContainer}>
                <View style={s.stepNumberBubble}>
                  <Text style={s.stepNumber}>2</Text>
                </View>
                <View style={s.stepConnectorLine} />
              </View>
              <View style={s.stepContent}>
                <Text style={s.stepTitle}>Trigger Connection</Text>
                <Text style={s.stepDesc}>
                  Open Command Palette (<Text style={s.monospaceText}>⌘+Shift+P</Text>) and run
                  'CodeLink: Pair Mobile'.
                </Text>
              </View>
            </View>

            <View style={s.stepRow}>
              <View style={s.stepIndicatorContainer}>
                <View style={s.stepNumberBubble}>
                  <Text style={s.stepNumber}>3</Text>
                </View>
              </View>
              <View style={s.stepContent}>
                <Text style={s.stepTitle}>Scan & Link</Text>
                <Text style={s.stepDesc}>
                  Tap the button below and scan the QR code displayed in your connection dialog.
                </Text>
              </View>
            </View>
          </View>

          {/* Visual Atmosphere Card */}
          <View style={s.atmosphereCard}>
            <View style={s.atmosphereIconContainer}>
              <Text style={s.atmosphereEmoji}>📷</Text>
            </View>
            <Text style={s.atmosphereText}>READY FOR QR SCAN</Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Footer Action */}
      <View style={s.footer}>
        <TouchableOpacity style={s.getStartedBtn} onPress={handleGetStarted} activeOpacity={0.8}>
          <Text style={s.getStartedText}>Get Started</Text>
          <Text style={s.getStartedArrow}>➔</Text>
        </TouchableOpacity>
        <Text style={s.footerVersion}>VERSION 2.4.0 • OBSIDIAN PROTOCOL</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121317',
  },
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121317',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 160,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 540,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#292a2e',
    paddingBottom: 16,
    marginBottom: 28,
  },
  headerLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoSymbol: {
    fontSize: 20,
    color: '#0078d4',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e3e2e7',
    fontFamily: 'System',
  },
  headerHelp: {
    fontSize: 20,
    color: '#c0c7d4',
  },
  heroSection: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e3e2e7',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  heroAccent: {
    color: '#a3c9ff',
  },
  heroDesc: {
    fontSize: 15,
    color: '#c0c7d4',
    lineHeight: 22,
  },
  mockTerminal: {
    backgroundColor: '#0d0e12',
    borderWidth: 1,
    borderColor: '#404752',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 36,
    position: 'relative',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f1f24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#292a2e',
  },
  terminalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  terminalIcon: {
    fontSize: 12,
  },
  terminalTitle: {
    fontSize: 11,
    color: '#c0c7d4',
    fontFamily: 'monospace',
  },
  windowButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  winBtn: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  terminalBody: {
    padding: 14,
    gap: 4,
  },
  codeLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeLineAdded: {
    backgroundColor: 'rgba(78, 201, 78, 0.12)',
    borderRadius: 2,
    marginVertical: 1,
    paddingVertical: 1,
  },
  codeLineNumber: {
    fontSize: 12,
    color: '#404752',
    width: 20,
    fontFamily: 'monospace',
  },
  codeLineNumberAdded: {
    color: '#4ec94e',
  },
  codeText: {
    fontSize: 12,
    color: '#e3e2e7',
    fontFamily: 'monospace',
  },
  codeTextAdded: {
    fontSize: 12,
    color: '#4ec94e',
    fontFamily: 'monospace',
  },
  terminalCursor: {
    width: 2,
    height: 16,
    backgroundColor: '#a3c9ff',
  },
  activeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f24',
    borderWidth: 1,
    borderColor: '#404752',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#a3c9ff',
    letterSpacing: 1,
  },
  glowingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ec94e',
    marginRight: 6,
    shadowColor: '#4ec94e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionHeaderBar: {
    width: 3,
    height: 14,
    backgroundColor: '#0078d4',
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0078d4',
    letterSpacing: 1.5,
  },
  cardGrid: {
    gap: 12,
    marginBottom: 36,
  },
  capabilityCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1b20',
    borderWidth: 1,
    borderColor: '#292a2e',
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  capabilityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#292a2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#404752',
  },
  capabilityEmoji: {
    fontSize: 18,
  },
  capabilityTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  capabilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e3e2e7',
    marginBottom: 4,
  },
  capabilityDesc: {
    fontSize: 13,
    color: '#c0c7d4',
    lineHeight: 18,
  },
  stepsContainer: {
    paddingLeft: 4,
    marginBottom: 36,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stepIndicatorContainer: {
    alignItems: 'center',
  },
  stepNumberBubbleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0078d4',
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404752',
    backgroundColor: '#1a1b20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0078d4',
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c0c7d4',
  },
  stepConnectorLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#292a2e',
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e3e2e7',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: '#c0c7d4',
    lineHeight: 18,
  },
  monospaceText: {
    fontFamily: 'monospace',
    color: '#a3c9ff',
    fontSize: 12,
  },
  atmosphereCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0e12',
    borderWidth: 1,
    borderColor: '#292a2e',
    borderRadius: 12,
    paddingVertical: 18,
    gap: 8,
    marginBottom: 16,
  },
  atmosphereIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 120, 212, 0.3)',
  },
  atmosphereEmoji: {
    fontSize: 12,
  },
  atmosphereText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c0c7d4',
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 27, 32, 0.92)',
    borderTopWidth: 1,
    borderTopColor: '#292a2e',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  getStartedBtn: {
    width: '100%',
    maxWidth: 500,
    height: 48,
    backgroundColor: '#0078d4',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0078d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  getStartedArrow: {
    color: '#fff',
    fontSize: 16,
  },
  footerVersion: {
    fontSize: 9,
    color: '#404752',
    letterSpacing: 1.5,
    marginTop: 12,
    fontFamily: 'monospace',
  },
});
