import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../types';

const ARRIVAL_HISTORY_KEY = '@pointme:arrival_history';
const ARRIVAL_COUNT_KEY = '@pointme:arrival_count';
const DISTANCE_PREFERENCES_KEY = '@pointme:distance_preferences';

export interface ArrivalHistoryItem {
  place: Place;
  arrivedAt: number; // timestamp
}

/**
 * Get the arrival history (last 5 places)
 */
export async function getArrivalHistory(): Promise<ArrivalHistoryItem[]> {
  try {
    const data = await AsyncStorage.getItem(ARRIVAL_HISTORY_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error getting arrival history:', error);
    return [];
  }
}

/**
 * Add a new arrival to history (keeps only last 5)
 */
export async function addArrival(place: Place): Promise<void> {
  try {
    const history = await getArrivalHistory();
    
    // Add new arrival at the beginning
    const newHistory: ArrivalHistoryItem[] = [
      {
        place,
        arrivedAt: Date.now(),
      },
      ...history,
    ].slice(0, 5); // Keep only last 5
    
    await AsyncStorage.setItem(ARRIVAL_HISTORY_KEY, JSON.stringify(newHistory));
    
    // Update arrival count
    const count = await getArrivalCount();
    await AsyncStorage.setItem(ARRIVAL_COUNT_KEY, String(count + 1));
  } catch (error) {
    console.error('Error adding arrival:', error);
  }
}

/**
 * Get the total arrival count
 */
export async function getArrivalCount(): Promise<number> {
  try {
    const count = await AsyncStorage.getItem(ARRIVAL_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Error getting arrival count:', error);
    return 0;
  }
}

/**
 * Get place IDs from the last 5 arrivals (for exclusion in searches)
 */
export async function getRecentPlaceIds(): Promise<string[]> {
  try {
    const history = await getArrivalHistory();
    return history
      .map((item) => item.place.placeId)
      .filter((id): id is string => !!id); // Filter out undefined
  } catch (error) {
    console.error('Error getting recent place IDs:', error);
    return [];
  }
}

/**
 * Clear arrival history (but keep the arrival count)
 */
export async function clearArrivalHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ARRIVAL_HISTORY_KEY);
    // Note: We keep ARRIVAL_COUNT_KEY so the total count is preserved
  } catch (error) {
    console.error('Error clearing arrival history:', error);
  }
}

/**
 * Clear all storage (for testing purposes)
 * This clears both arrival history and arrival count
 */
export async function clearAllStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ARRIVAL_HISTORY_KEY);
    await AsyncStorage.removeItem(ARRIVAL_COUNT_KEY);
    console.log('All storage cleared');
  } catch (error) {
    console.error('Error clearing all storage:', error);
  }
}

export interface DistancePreferences {
  minDistanceMiles?: number; // Optional minimum distance in miles
  maxDistanceMiles?: number; // Optional maximum distance in miles
  enabled: boolean; // Whether distance filtering is enabled
}

/**
 * Get distance preferences for paid users
 */
export async function getDistancePreferences(): Promise<DistancePreferences> {
  try {
    const data = await AsyncStorage.getItem(DISTANCE_PREFERENCES_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return { enabled: false };
  } catch (error) {
    console.error('Error getting distance preferences:', error);
    return { enabled: false };
  }
}

/**
 * Save distance preferences for paid users
 */
export async function saveDistancePreferences(preferences: DistancePreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(DISTANCE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving distance preferences:', error);
  }
}

