import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Keychain / Keystore key (alphanumeric + . - _ only) */
const ARRIVAL_COUNT_SECURE_KEY = 'pointme_arrival_count';
/** Legacy AsyncStorage key — used only to migrate existing installs */
const ARRIVAL_COUNT_LEGACY_KEY = '@pointme:arrival_count';

function parseCount(value: string | null): number | null {
  if (value === null) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Arrival count for the free-tier limit. Stored in iOS Keychain / Android
 * EncryptedSharedPreferences so it survives app reinstall (iOS) or device
 * backup restore (Android Auto Backup).
 */
export async function getSecureArrivalCount(): Promise<number> {
  try {
    const secureValue = await SecureStore.getItemAsync(ARRIVAL_COUNT_SECURE_KEY);
    const secureCount = parseCount(secureValue);

    if (secureCount !== null) {
      return secureCount;
    }

    // One-time migration for users updating without reinstalling
    const legacyValue = await AsyncStorage.getItem(ARRIVAL_COUNT_LEGACY_KEY);
    const legacyCount = parseCount(legacyValue);

    if (legacyCount !== null && legacyCount > 0) {
      await SecureStore.setItemAsync(ARRIVAL_COUNT_SECURE_KEY, String(legacyCount));
      return legacyCount;
    }

    return 0;
  } catch (error) {
    console.error('Error reading secure arrival count:', error);
    const legacyValue = await AsyncStorage.getItem(ARRIVAL_COUNT_LEGACY_KEY);
    return parseCount(legacyValue) ?? 0;
  }
}

export async function setSecureArrivalCount(count: number): Promise<void> {
  const value = String(count);
  await SecureStore.setItemAsync(ARRIVAL_COUNT_SECURE_KEY, value);
  // Keep legacy copy in sync for the current install session / dev tools
  await AsyncStorage.setItem(ARRIVAL_COUNT_LEGACY_KEY, value);
}

export async function clearSecureArrivalCount(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ARRIVAL_COUNT_SECURE_KEY);
  } catch {
    // Item may not exist
  }
  await AsyncStorage.removeItem(ARRIVAL_COUNT_LEGACY_KEY);
}
