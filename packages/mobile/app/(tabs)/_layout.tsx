import { Tabs } from 'expo-router';

export default function TabsLayout() {
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
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
