import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#1e1e1e' }, headerTintColor: '#ccc' }}>
        <Stack.Screen name="index"   options={{ headerShown: false }} />
        <Stack.Screen name="pairing" options={{ title: 'Pair with VS Code' }} />
        <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
      </Stack>
    </>
  );
}