import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { joinSession, getDeviceId } from '../src/api/authClient';
import { decodePairingPayload } from '../src/api/pairing';
import { wsManager } from '../src/ws/WsManager';
import { handleMessage } from '../src/ws/MessageDispatcher';
import { useSessionStore } from '../src/store/useSessionStore';
import { AUTH_URL } from '../src/api/config';

export default function PairingScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pairingInput, setPairingInput] = useState('');
  const router = useRouter();

  const processPairingCode = async (data: string) => {
    if (joining) {
      return;
    }
    setJoining(true);
    setErrorMsg(null);

    try {
      const decoded = decodePairingPayload(data);

      const deviceId = await getDeviceId();
      const session = await joinSession(AUTH_URL, decoded.sessionId, decoded.challenge, deviceId);

      wsManager.onMessage = handleMessage;
      wsManager.onConnected = () => {
        useSessionStore.getState().setConnected(session.sessionId);
        wsManager.send('SNAPSHOT_REQUEST', { fileName: '', reason: 'initial' });
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

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || joining) {
      return;
    }
    setScanned(true);
    await processPairingCode(data);
  };

  const handleManualJoin = async () => {
    if (!pairingInput.trim() || joining) {
      return;
    }
    await processPairingCode(pairingInput.trim());
  };

  const isWeb = Platform.OS === 'web';

  // ── Native Permission states (keep native behavior unchanged) ───────────
  if (!isWeb) {
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
  }

  if (joining) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0078d4" />
        <Text style={[s.body, { marginTop: 16 }]}>Connecting…</Text>
      </View>
    );
  }

  // ── Web UI ───────────────────────────────────────────────────────────────
  if (isWeb) {
    const hasCamera = Boolean(permission?.granted);

    return (
      <View style={s.root}>
        {hasCamera && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        <View style={[s.overlay, s.webOverlay]}>
          <Text style={s.title}>Pair Mobile Device</Text>
          <Text style={s.subtitle}>
            In VS Code, run the command{'\n'}
            <Text style={s.command}>CodeLink: Pair Mobile Device</Text>
          </Text>

          {hasCamera && <View style={s.frame} />}

          <View style={s.webCard}>
            <Text style={s.inputLabel}>Paste pairing code:</Text>
            <TextInput
              style={s.input}
              placeholder="Paste pairing code here..."
              placeholderTextColor="#777"
              value={pairingInput}
              onChangeText={setPairingInput}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleManualJoin}
            />
            <TouchableOpacity
              style={[s.btn, s.webBtn, (!pairingInput.trim() || joining) && s.btnDisabled]}
              onPress={handleManualJoin}
              disabled={!pairingInput.trim() || joining}
            >
              <Text style={s.btnText}>Join</Text>
            </TouchableOpacity>
          </View>

          {!hasCamera && (
            <TouchableOpacity style={s.textBtn} onPress={requestPermission}>
              <Text style={s.textBtnLabel}>Or allow camera to scan QR</Text>
            </TouchableOpacity>
          )}

          {errorMsg && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Main scanner UI (Native) ─────────────────────────────────────────────
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
  webOverlay: {
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webCard: {
    width: '100%',
    maxWidth: 440,
    marginTop: 24,
    backgroundColor: '#252526',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3c3c3c',
    gap: 12,
  },
  inputLabel: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  webBtn: {
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  textBtn: {
    marginTop: 16,
    padding: 8,
  },
  textBtnLabel: {
    color: '#4fc3f7',
    fontSize: 13,
    textAlign: 'center',
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
