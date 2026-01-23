import { Stack } from 'expo-router';
import { AppProvider } from '../context/AppContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="compass" />
        <Stack.Screen name="arrival" />
        <Stack.Screen name="history" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="settings" />
      </Stack>
    </AppProvider>
  );
}
