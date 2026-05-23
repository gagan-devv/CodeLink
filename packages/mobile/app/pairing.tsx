import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { joinSession, getDeviceId } from '../src/api/authClient';
import { wsManager } from '../src/ws/WsManager';
import { handleMessage } from '../src/ws/MessageDispatcher';
import { useSessionStore } from '../src/store/useSessionStore';
import { AUTH_URL } from '../src/api/config';

export default function PairingScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || joining) {
      return;
    }
    setScanned(true);
    setJoining(true);
    setErrorMsg(null);

    try {
      // Decode URL-safe base64 payload from VS Code QR
      const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))) as {
        sessionId: string;
        challenge: string;
        relayWss: string;
      };

      const deviceId = await getDeviceId();
      const session = await joinSession(AUTH_URL, decoded.sessionId, decoded.challenge, deviceId);

      wsManager.onMessage = handleMessage;
      wsManager.onConnected = () => {
        useSessionStore.getState().setConnected(session.sessionId);
        router.replace('/(tabs)');
      };
      wsManager.onDisconnected = () => {};
      wsManager.connect(session.relayWss, session.mobileToken);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setJoining(false);
      setScanned(false);
    }
  };

  // ── Permission states ────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#0078d4" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.body}>Camera access is needed to scan the QR code from VS Code.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (joining) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0078d4" />
        <Text style={[s.body, { marginTop: 16 }]}>Connecting…</Text>
      </View>
    );
  }

  // ── Main scanner UI ──────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay */}
      <View style={s.overlay}>
        <Text style={s.title}>Scan QR code</Text>
        <Text style={s.subtitle}>
          In VS Code, run the command{'\n'}
          <Text style={s.command}>CodeLink: Pair Mobile Device</Text>
        </Text>
        <View style={s.frame} />
        {errorMsg && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1e1e1e',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  command: { color: '#4fc3f7', fontFamily: 'monospace' },
  frame: {
    width: 260,
    height: 260,
    marginTop: 28,
    borderWidth: 2,
    borderColor: '#0078d4',
    borderRadius: 16,
    shadowColor: '#0078d4',
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  errorBox: {
    marginTop: 20,
    backgroundColor: 'rgba(200,50,50,0.85)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  body: { color: '#aaa', fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  btn: { backgroundColor: '#0078d4', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
