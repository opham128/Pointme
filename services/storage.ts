import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place, Location, Category } from '../types';
import {
  clearSecureArrivalCount,
  getSecureArrivalCount,
  setSecureArrivalCount,
} from './secureStorage';

const ARRIVAL_HISTORY_KEY = '@pointme:arrival_history';
const DISTANCE_PREFERENCES_KEY = '@pointme:distance_preferences';
const PLACE_CACHE_KEY = '@pointme:place_cache';
const DISTANCE_UNIT_KEY = '@pointme:distance_unit';

// Cache expiration: 10 minutes
const CACHE_EXPIRATION_MS = 10 * 60 * 1000;

interface CachedPlaceResult {
  place: Place | null;
  places: Place[]; // Store top 5 places for client-side filtering
  cachedAt: number;
  location: Location; // Rounded location used for cache key
  category: Category;
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number };
}

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
    
    // Update arrival count (Keychain / secure storage — survives reinstall on iOS)
    const count = await getArrivalCount();
    await setSecureArrivalCount(count + 1);
  } catch (error) {
    console.error('Error adding arrival:', error);
  }
}

/**
 * Get the total arrival count
 */
export async function getArrivalCount(): Promise<number> {
  return getSecureArrivalCount();
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
    // Note: arrival count is kept in Keychain / secure storage
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
    await clearSecureArrivalCount();
    const { clearReviewPromptState } = await import('./reviewPrompt');
    await clearReviewPromptState();
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

/**
 * Round location to ~100m precision for cache key (avoids micro-movements causing cache misses)
 * This means locations within ~100m will share the same cache entry
 */
function roundLocationForCache(location: Location): Location {
  // Round to ~0.001 degrees (approximately 100m)
  return {
    latitude: Math.round(location.latitude * 1000) / 1000,
    longitude: Math.round(location.longitude * 1000) / 1000,
  };
}

/**
 * Generate cache key from category, rounded location, and category preferences
 */
function getCacheKey(
  category: Category, 
  location: Location, 
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): string {
  const rounded = roundLocationForCache(location);
  const categoryPrefsKey = categoryPreferences 
    ? `${categoryPreferences.restaurantCuisine || 'none'}-${categoryPreferences.barPriceLevel ?? 'none'}`
    : 'none';
  return `${category}-${rounded.latitude.toFixed(3)}-${rounded.longitude.toFixed(3)}-${categoryPrefsKey}`;
}

/**
 * Get cached places (top 5) if available and not expired
 */
export async function getCachedPlaces(
  category: Category,
  location: Location,
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): Promise<Place[] | undefined> {
  try {
    const cacheData = await AsyncStorage.getItem(PLACE_CACHE_KEY);
    if (!cacheData) return undefined;

    const cache: Record<string, CachedPlaceResult> = JSON.parse(cacheData);
    const cacheKey = getCacheKey(category, location, categoryPreferences);
    const cached = cache[cacheKey];

    if (!cached) return undefined;

    // Check if cache is expired
    const age = Date.now() - cached.cachedAt;
    if (age > CACHE_EXPIRATION_MS) {
      // Remove expired entry
      delete cache[cacheKey];
      await AsyncStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(cache));
      return undefined;
    }

    return cached.places || (cached.place ? [cached.place] : []); // Return all cached places
  } catch (error) {
    console.error('Error getting cached places:', error);
    return undefined;
  }
}

/**
 * Get cached place result if available and not expired (backward compatibility)
 */
export async function getCachedPlace(
  category: Category,
  location: Location,
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): Promise<Place | null | undefined> {
  const places = await getCachedPlaces(category, location, categoryPreferences);
  return places && places.length > 0 ? places[0] : (places === undefined ? undefined : null);
}

/**
 * Cache places (top 5) for a category/location
 */
export async function cachePlaces(
  category: Category,
  location: Location,
  places: Place[],
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): Promise<void> {
  try {
    const cacheData = await AsyncStorage.getItem(PLACE_CACHE_KEY);
    const cache: Record<string, CachedPlaceResult> = cacheData ? JSON.parse(cacheData) : {};

    // Clean up expired entries (keep cache size manageable)
    const now = Date.now();
    Object.keys(cache).forEach((key) => {
      if (now - cache[key].cachedAt > CACHE_EXPIRATION_MS) {
        delete cache[key];
      }
    });

    // Limit cache size to 50 entries (remove oldest if needed)
    const entries = Object.entries(cache);
    if (entries.length >= 50) {
      // Sort by cachedAt and remove oldest 10
      const sorted = entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
      sorted.slice(0, 10).forEach(([key]) => delete cache[key]);
    }

    const cacheKey = getCacheKey(category, location, categoryPreferences);
    // Store top 5 places
    const topPlaces = places.slice(0, 5);
    cache[cacheKey] = {
      place: topPlaces[0] || null, // Keep for backward compatibility
      places: topPlaces,
      cachedAt: Date.now(),
      location: roundLocationForCache(location),
      category,
      categoryPreferences,
    };

    await AsyncStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error caching places:', error);
  }
}

/**
 * Cache a place result (backward compatibility - stores single place)
 */
export async function cachePlace(
  category: Category,
  location: Location,
  place: Place | null,
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): Promise<void> {
  if (place) {
    await cachePlaces(category, location, [place], categoryPreferences);
  } else {
    await cachePlaces(category, location, [], categoryPreferences);
  }
}

/**
 * Clear a specific cache entry by cache key
 */
export async function clearCacheEntry(
  category: Category,
  location: Location,
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): Promise<void> {
  try {
    const cacheData = await AsyncStorage.getItem(PLACE_CACHE_KEY);
    if (!cacheData) return;

    const cache: Record<string, CachedPlaceResult> = JSON.parse(cacheData);
    const cacheKey = getCacheKey(category, location, categoryPreferences);
    
    if (cache[cacheKey]) {
      delete cache[cacheKey];
      await AsyncStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Error clearing cache entry:', error);
  }
}

/**
 * Clear place cache (for testing or when needed)
 */
export async function clearPlaceCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PLACE_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing place cache:', error);
  }
}

export type DistanceUnit = 'feet' | 'meters';

/**
 * Get distance unit preference (feet or meters)
 */
export async function getDistanceUnit(): Promise<DistanceUnit> {
  try {
    const unit = await AsyncStorage.getItem(DISTANCE_UNIT_KEY);
    return (unit === 'meters' ? 'meters' : 'feet') as DistanceUnit;
  } catch (error) {
    console.error('Error getting distance unit:', error);
    return 'feet'; // Default to feet
  }
}

/**
 * Save distance unit preference
 */
export async function saveDistanceUnit(unit: DistanceUnit): Promise<void> {
  try {
    await AsyncStorage.setItem(DISTANCE_UNIT_KEY, unit);
  } catch (error) {
    console.error('Error saving distance unit:', error);
  }
}
