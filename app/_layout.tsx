import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from '@expo-google-fonts/sora/useFonts';
import {
  Sora_300Light,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import { AppProvider } from '../context/AppContext';
import { StatusBar } from 'expo-status-bar';

// Load dev-only test helpers so global.__pointmeDev is available in __DEV__
if (__DEV__) {
  require('../devTesting');
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

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
