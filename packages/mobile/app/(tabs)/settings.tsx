import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter }       from 'expo-router';
import { useSessionStore } from '../../src/store/useSessionStore';
import { useDiffStore }    from '../../src/store/useDiffStore';
import { usePromptStore }  from '../../src/store/usePromptStore';
import { wsManager }       from '../../src/ws/WsManager';
import { clearStoredSession } from '../../src/api/authClient';
import { patchEngine }     from '../../src/diff/PatchEngine';

export default function SettingsTab() {
  const router    = useRouter();
  const status    = useSessionStore(s => s.status);
  const sessionId = useSessionStore(s => s.sessionId);

  const disconnect = () => {
    Alert.alert(
      'Disconnect',
      'This will end the current session. You will need to scan a new QR code to reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive',
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

  const statusColor = status === 'connected'   ? '#4ec94e'
                    : status === 'connecting'   ? '#e5c07b'
                    : status === 'revoked'      ? '#f55'
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
  root:           { flex: 1, backgroundColor: '#1e1e1e', padding: 16, gap: 12 },
  card:           { backgroundColor: '#252526', borderRadius: 12, overflow: 'hidden' },
  dot:            { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  value:          { fontSize: 14, fontWeight: '600' },
  mono:           { color: '#888', fontSize: 13, fontFamily: 'monospace' },
  pairBtn:        { padding: 16, alignItems: 'center' },
  pairBtnText:    { color: '#0078d4', fontSize: 15, fontWeight: '600' },
  disconnectBtn:  { padding: 16, alignItems: 'center' },
  disconnectText: { color: '#f55', fontSize: 15, fontWeight: '600' },
});

const r = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#333' },
  label: { color: '#888', fontSize: 14, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
});