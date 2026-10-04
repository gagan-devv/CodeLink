import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../../src/store/useSessionStore';
import { useDiffStore } from '../../src/store/useDiffStore';
import { usePromptStore } from '../../src/store/usePromptStore';
import { useTerminalStore } from '../../src/terminal/useTerminalStore';
import { isTerminalFeatureFlagEnabled } from '../../src/terminal/terminalGating';
import { MobilePairingService } from '../../src/crypto/MobilePairingService';
import { wsManager } from '../../src/ws/WsManager';
import { clearStoredSession } from '../../src/api/authClient';
import { patchEngine } from '../../src/diff/PatchEngine';

export default function SettingsTab() {
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const sessionId = useSessionStore((s) => s.sessionId);

  const isTerminalEnabled = isTerminalFeatureFlagEnabled();
  const e2eeState = useTerminalStore((s) => s.e2eeState);
  const sasCode = useTerminalStore((s) => s.sasCode);
  const deviceId = useTerminalStore((s) => s.deviceId);
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);

  const handlePairTerminal = async () => {
    if (!pairingCodeInput.trim() || isPairing) return;
    setIsPairing(true);
    try {
      await MobilePairingService.initiatePairing(pairingCodeInput.trim());
      setPairingCodeInput('');
    } finally {
      setIsPairing(false);
    }
  };

  const handleUnpairTerminal = () => {
    Alert.alert(
      'Unpair Terminal Companion',
      'This will remove paired keys and hide the terminal tab. You will need to pair again with a new code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            await MobilePairingService.unpair();
          },
        },
      ]
    );
  };

  const disconnect = () => {
    Alert.alert(
      'Disconnect',
      'This will end the current session. You will need to scan a new QR code to reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            wsManager.disconnect();
            await clearStoredSession();
            patchEngine.clearAll();
            useDiffStore.getState().clear();
            usePromptStore.getState().clear();
            useSessionStore.getState().reset();
            router.replace('/pairing');
          },
        },
      ]
    );
  };

  const statusColor =
    status === 'connected'
      ? '#4ec94e'
      : status === 'connecting'
        ? '#e5c07b'
        : status === 'revoked'
          ? '#f55'
          : '#666';

  return (
    <View style={s.root}>
      <View style={s.card}>
        <Row label="Status">
          <View style={[s.dot, { backgroundColor: statusColor }]} />
          <Text style={[s.value, { color: statusColor }]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </Row>
        {sessionId && (
          <Row label="Session">
            <Text style={s.mono}>{sessionId.slice(0, 20)}…</Text>
          </Row>
        )}
      </View>

      {isTerminalEnabled && (
        <View style={s.card}>
          <Row label="Terminal Companion">
            <View
              style={[
                s.dot,
                {
                  backgroundColor:
                    e2eeState === 'paired'
                      ? '#4ec94e'
                      : e2eeState === 'pending_approval'
                        ? '#e5c07b'
                        : '#888',
                },
              ]}
            />
            <Text
              style={[
                s.value,
                {
                  color:
                    e2eeState === 'paired'
                      ? '#4ec94e'
                      : e2eeState === 'pending_approval'
                        ? '#e5c07b'
                        : '#888',
                },
              ]}
            >
              {e2eeState === 'paired'
                ? 'Paired'
                : e2eeState === 'pending_approval'
                  ? 'Pending Host Approval'
                  : 'Not Paired'}
            </Text>
          </Row>

          {e2eeState === 'paired' && deviceId && (
            <Row label="Host Device ID">
              <Text style={s.mono}>{deviceId.slice(0, 16)}…</Text>
            </Row>
          )}

          {e2eeState === 'pending_approval' && sasCode && (
            <View style={s.sasBox}>
              <Text style={s.sasLabel}>SAS Verification Code:</Text>
              <Text style={s.sasText}>{sasCode}</Text>
              <Text style={s.sasHelp}>Confirm this code matches on your laptop companion.</Text>
            </View>
          )}

          {e2eeState === 'paired' ? (
            <TouchableOpacity style={s.unpairBtn} onPress={handleUnpairTerminal}>
              <Text style={s.unpairText}>Unpair Terminal Companion</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.pairTerminalBox}>
              <TextInput
                style={s.input}
                placeholder="6-digit Pairing Code"
                placeholderTextColor="#666"
                value={pairingCodeInput}
                onChangeText={setPairingCodeInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[s.pairSubmitBtn, !pairingCodeInput.trim() && s.pairSubmitBtnDisabled]}
                onPress={handlePairTerminal}
                disabled={!pairingCodeInput.trim() || isPairing}
              >
                {isPairing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.pairSubmitText}>Pair Terminal</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <View style={s.card}>
        <TouchableOpacity style={s.pairBtn} onPress={() => router.push('/pairing')}>
          <Text style={s.pairBtnText}>Pair New Device</Text>
        </TouchableOpacity>
      </View>

      {status === 'connected' && (
        <View style={s.card}>
          <TouchableOpacity style={s.disconnectBtn} onPress={disconnect}>
            <Text style={s.disconnectText}>Disconnect Session</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={r.row}>
      <Text style={r.label}>{label}</Text>
      <View style={r.right}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e1e1e', padding: 16, gap: 12 },
  card: { backgroundColor: '#252526', borderRadius: 12, overflow: 'hidden' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  value: { fontSize: 14, fontWeight: '600' },
  mono: { color: '#888', fontSize: 13, fontFamily: 'monospace' },
  pairBtn: { padding: 16, alignItems: 'center' },
  pairBtnText: { color: '#0078d4', fontSize: 15, fontWeight: '600' },
  disconnectBtn: { padding: 16, alignItems: 'center' },
  disconnectText: { color: '#f55', fontSize: 15, fontWeight: '600' },
  unpairBtn: { padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#333' },
  unpairText: { color: '#f55', fontSize: 14, fontWeight: '600' },
  pairTerminalBox: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: '#333' },
  input: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  pairSubmitBtn: {
    backgroundColor: '#0078d4',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pairSubmitBtnDisabled: { backgroundColor: '#333' },
  pairSubmitText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sasBox: {
    padding: 14,
    backgroundColor: '#181818',
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  sasLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  sasText: { color: '#4ec94e', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  sasHelp: { color: '#aaa', fontSize: 12, marginTop: 4, textAlign: 'center' },
});

const r = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  label: { color: '#888', fontSize: 14, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
