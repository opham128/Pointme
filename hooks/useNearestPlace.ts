import { useState, useEffect, useRef } from 'react';
import { Location, Place, Category } from '../types';
import { findNearestPlace } from '../services/mapboxPlaces';
import { useNetworkStatus } from './useNetworkStatus';
import { getCachedPlace, getCachedPlaces, cachePlace, cachePlaces, getRecentPlaceIds, clearCacheEntry } from '../services/storage';
import { calculateDistance } from '../services/mapboxPlaces';

// Helper to round location for cache key (matches storage.ts logic)
function roundLocationForCache(location: Location): Location {
  return {
    latitude: Math.round(location.latitude * 1000) / 1000,
    longitude: Math.round(location.longitude * 1000) / 1000,
  };
}

// Helper to generate cache key (matches storage.ts logic)
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
import { useAppContext } from '../context/AppContext';

/**
 * Hook to find and track the nearest place of a given category
 * Only fetches once when category or initial location is set
 * 
 * @param userLocation User's current location
 * @param category Category to search for
 * @param enabled Whether to actively search
 * @returns Nearest place, loading state, and error
 */
export function useNearestPlace(
  userLocation: Location | null,
  category: Category | null,
  enabled: boolean = true
): {
  place: Place | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useNetworkStatus();
  const { hasPurchased, categoryPreferences } = useAppContext();
  
  // Track if we've already fetched for this category
  const fetchedCategoryRef = useRef<Category | null>(null);
  const hasFetchedRef = useRef<boolean>(false);
  const initialLocationRef = useRef<Location | null>(null);
  const lastCategoryPreferencesRef = useRef<{ restaurantCuisine?: string; barPriceLevel?: number } | null | undefined>(undefined);
  const isFetchingRef = useRef<boolean>(false); // Prevent concurrent fetches
  const currentRequestKeyRef = useRef<string | null>(null); // Track current request to prevent duplicates

  const fetchNearestPlace = async (skipCache: boolean = false) => {
    if (!userLocation || !category || !enabled) {
      return;
    }

    // Create a unique key for this request
    const requestKey = `${category}-${userLocation.latitude.toFixed(4)}-${userLocation.longitude.toFixed(4)}-${JSON.stringify(categoryPreferences)}`;
    
    // Prevent concurrent fetches with the same parameters
    // Check FIRST before any async operations to prevent race conditions
    if (isFetchingRef.current) {
      if (currentRequestKeyRef.current === requestKey) {
        console.log('⚠️ Fetch already in progress for same parameters, skipping duplicate call');
        // Don't modify ANY state - just return early and let the primary call handle everything
        return;
      } else {
        console.log('⚠️ Different fetch in progress, but allowing this one');
      }
    }
    
    // Set guard IMMEDIATELY and SYNCHRONOUSLY (before any async operations)
    isFetchingRef.current = true;
    currentRequestKeyRef.current = requestKey;
    
    // Set loading state ONLY for the primary call (not duplicates)
    setLoading(true);
    setError(null);

    // Check network status before attempting fetch
    if (!isOnline) {
      isFetchingRef.current = false;
      currentRequestKeyRef.current = null;
      setError(new Error('No internet connection. Please check your network and try again.'));
      setPlace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get category preferences from context (set when category was selected)
      const currentCategoryPreferences = hasPurchased && categoryPreferences ? categoryPreferences : undefined;

      // Check cache first (unless explicitly skipping)
      // Only use cache if:
      // 1. Place hasn't been visited
      // 2. User hasn't moved too far from cached location (within ~500m)
      if (!skipCache) {
        const roundedLocation = roundLocationForCache(userLocation);
        const cachedPlaces = await getCachedPlaces(category, roundedLocation, currentCategoryPreferences);
        if (cachedPlaces !== undefined) {
          // Get the cached entry to check the original location
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const cacheData = await AsyncStorage.getItem('@pointme:place_cache');
          
          if (cacheData) {
            const cache: Record<string, any> = JSON.parse(cacheData);
            const cacheKey = getCacheKey(category, roundedLocation, currentCategoryPreferences);
            const cached = cache[cacheKey];
            
            if (cached && cached.location) {
              // Check if user has moved too far from cached location
              const MAX_CACHE_DISTANCE_METERS = 500; // ~0.3 miles
              const distanceFromCachedLocation = calculateDistance(userLocation, cached.location);
              
              if (distanceFromCachedLocation > MAX_CACHE_DISTANCE_METERS) {
                // User moved too far - clear cache and fetch new
                console.log(`User moved ${Math.round(distanceFromCachedLocation)}m from cached location, clearing cache`);
                await clearCacheEntry(category, roundedLocation, currentCategoryPreferences);
                // Continue to fetch below
              } else {
                // Get recent place IDs to exclude visited places
                const recentPlaceIds = await getRecentPlaceIds();
                
                // Filter out visited places from cached results
                const unvisitedPlaces = cachedPlaces.filter(place => 
                  place && place.placeId && !recentPlaceIds.includes(place.placeId)
                );
                
                if (unvisitedPlaces.length > 0) {
                  // Use the nearest unvisited place from cache
                  const nearestUnvisited = unvisitedPlaces[0];
                  isFetchingRef.current = false;
                  currentRequestKeyRef.current = null;
                  setPlace(nearestUnvisited);
                  fetchedCategoryRef.current = category;
                  hasFetchedRef.current = true;
                  initialLocationRef.current = userLocation;
                  setLoading(false);
                  return;
                } else if (cachedPlaces.length === 0) {
                  // Cache hit but no places found (null) - use it
                  isFetchingRef.current = false;
                  currentRequestKeyRef.current = null;
                  setPlace(null);
                  fetchedCategoryRef.current = category;
                  hasFetchedRef.current = true;
                  initialLocationRef.current = userLocation;
                  setLoading(false);
                  return;
                } else {
                  // All cached places were visited - clear cache and fetch new
                  console.log(`All ${cachedPlaces.length} cached places were already visited, clearing cache and fetching new results`);
                  await clearCacheEntry(category, roundedLocation, currentCategoryPreferences);
                  // Continue to fetch below
                }
              }
            }
          }
        }
      }

      // Cache miss or skipCache - fetch from API
      console.log('🔄 Starting findNearestPlace...');
      const nearestPlace = await findNearestPlace(userLocation, category, currentCategoryPreferences);
      
      console.log('✅ findNearestPlace returned:', nearestPlace ? `${nearestPlace.name} (${nearestPlace.placeId})` : 'null');
      
      // CRITICAL: Update refs FIRST to prevent useEffect from resetting place
      // The useEffect checks if category changed, so we must update refs before setting state
      fetchedCategoryRef.current = category;
      hasFetchedRef.current = true;
      initialLocationRef.current = userLocation;
      
      // Now update state - refs are already set so useEffect won't interfere
      // Update all state synchronously to prevent race conditions
      console.log('📝 Setting place state to:', nearestPlace ? nearestPlace.name : 'null');
      setPlace(nearestPlace);
      setError(null);
      setLoading(false);
      console.log('✅ State updated - place:', nearestPlace ? nearestPlace.name : 'null', 'loading: false');
      
      // Cache the result (do this after setting state so UI updates immediately)
      // Cache multiple places (top 5) for client-side filtering
      if (nearestPlace) {
        // Check if the result includes all places for caching
        const allPlaces = (nearestPlace as any)._allPlaces || [nearestPlace];
        // Don't await - let it cache in the background
        cachePlaces(category, userLocation, allPlaces, currentCategoryPreferences).catch((err: any) => {
          console.error('Failed to cache places:', err);
        });
      }
      
      // Clear guard after state is set
      isFetchingRef.current = false;
      if (currentRequestKeyRef.current === requestKey) {
        currentRequestKeyRef.current = null;
      }
    } catch (err) {
      // Ignore duplicate call errors - another call is handling the search
      if (err instanceof Error && err.message === 'DUPLICATE_CALL_BLOCKED') {
        console.log('⚠️ Duplicate call blocked, waiting for primary call to complete');
        // Don't modify ANY state - the primary call will handle everything
        // Just clear the guard for THIS call and return early
        isFetchingRef.current = false;
        if (currentRequestKeyRef.current === requestKey) {
          currentRequestKeyRef.current = null;
        }
        // Return early - don't modify loading/error/place state
        return;
      }
      
      const error = err instanceof Error ? err : new Error('Failed to find nearest place');
      console.error('❌ Error in fetchNearestPlace:', error.message);
      setError(error);
      setPlace(null);
      setLoading(false);
      
      // Clear guard
      isFetchingRef.current = false;
      if (currentRequestKeyRef.current === requestKey) {
        currentRequestKeyRef.current = null;
      }
    }
  };

  useEffect(() => {
    // Don't do anything if already fetching - let the current fetch complete
    if (isFetchingRef.current) {
      return;
    }
    
    // Check if category preferences actually changed (compare values, not references)
    // Use a stable string comparison to avoid false positives from object reference changes
    const currentPrefsStr = JSON.stringify(categoryPreferences || null);
    const lastPrefsStr = JSON.stringify(lastCategoryPreferencesRef.current || null);
    const categoryPrefsChanged = currentPrefsStr !== lastPrefsStr;
    
    // Don't fetch if we have an auth error - these need manual intervention
    const hasAuthError = error && (
      error.message?.toLowerCase().includes('auth') || 
      error.message?.toLowerCase().includes('token') ||
      error.message?.toLowerCase().includes('authentication')
    );
    
    if (hasAuthError) {
      return; // Don't retry on auth errors
    }
    
    // Only fetch if:
    // 1. We have a location and category but haven't fetched yet, OR
    // 2. The category has changed (and we need to refetch for new category), OR
    // 3. Category preferences changed (need to refetch with new filters)
    const categoryChanged = fetchedCategoryRef.current !== category;
    const hasLocationButNotFetched = userLocation && !hasFetchedRef.current;
    
    // Reset place when category or preferences change
    // BUT only if we're not currently fetching AND we have already fetched before
    // This prevents resetting immediately after we just set it
    if ((categoryChanged || categoryPrefsChanged) && fetchedCategoryRef.current !== null && !isFetchingRef.current && hasFetchedRef.current) {
      setPlace(null);
      hasFetchedRef.current = false;
    }
    
    const shouldFetch = (hasLocationButNotFetched || categoryChanged || categoryPrefsChanged) && userLocation && category && enabled && !isFetchingRef.current;
    
    if (shouldFetch) {
      // Set loading state immediately when starting fetch
      setLoading(true);
      fetchNearestPlace();
    }
  }, [category, enabled, userLocation, categoryPreferences, error]); // Include error to detect auth errors

  // Auto-retry when coming back online after an error
  useEffect(() => {
    if (isOnline && error && userLocation && category && enabled) {
      // Don't retry on auth errors - these need manual intervention
      const errorIsAuth = error.message?.toLowerCase().includes('auth') || 
                          error.message?.toLowerCase().includes('token') ||
                          error.message?.toLowerCase().includes('authentication');
      if (errorIsAuth) {
        return; // Don't auto-retry auth errors
      }
      
      // Only retry if we had an error and now we're online
      const errorIsOffline = error.message?.toLowerCase().includes('internet') || 
                            error.message?.toLowerCase().includes('network');
      if (errorIsOffline) {
        fetchNearestPlace();
      }
    }
  }, [isOnline, error, userLocation, category, enabled]);

  return {
    place,
    loading,
    error,
    refetch: () => fetchNearestPlace(true), // Skip cache on manual refetch
  };
}

