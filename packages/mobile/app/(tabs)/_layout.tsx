import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTerminalStore } from '../../src/terminal/useTerminalStore';
import { isTerminalTabVisible } from '../../src/terminal/terminalGating';
import { MobilePairingService } from '../../src/crypto/MobilePairingService';

export default function TabsLayout() {
  const e2eeState = useTerminalStore((s) => s.e2eeState);
  const showTerminal = isTerminalTabVisible(e2eeState);

  useEffect(() => {
    // Restore paired terminal companion session if previously paired
    MobilePairingService.restoreSessionIfPaired();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1e1e1e' },
        headerTintColor: '#ccc',
        tabBarStyle: { backgroundColor: '#252526', borderTopColor: '#333' },
        tabBarActiveTintColor: '#0078d4',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Editor', tabBarLabel: 'Editor' }} />
      <Tabs.Screen name="prompt" options={{ title: 'Prompt', tabBarLabel: 'Prompt' }} />
      <Tabs.Screen
        name="terminal"
        options={{
          title: 'Terminal',
          tabBarLabel: 'Terminal',
          href: showTerminal ? '/(tabs)/terminal' : null,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
