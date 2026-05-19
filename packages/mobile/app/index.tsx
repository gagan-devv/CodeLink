import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter }        from 'expo-router';
import { getStoredSession } from '../src/api/authClient';
import { wsManager }        from '../src/ws/WsManager';
import { handleMessage }    from '../src/ws/MessageDispatcher';
import { useSessionStore }  from '../src/store/useSessionStore';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    wsManager.onMessage      = handleMessage;
    wsManager.onConnected    = () => useSessionStore.getState().setConnected('restored');
    wsManager.onDisconnected = () => {};

    getStoredSession().then(session => {
      if (session) {
        useSessionStore.getState().setConnecting();
        wsManager.connect(session.relayWss, session.mobileToken);
        router.replace('/(tabs)');
      } else {
        router.replace('/pairing');
      }
    });
  }, []);

  return (
    <View style={s.root}>
      <ActivityIndicator size="large" color="#0078d4" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1e1e' },
});