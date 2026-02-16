import { useState, useEffect, useRef } from 'react';
import { Location, Place, Category } from '../types';
import { findNearestPlace } from '../services/mapboxPlaces';
import { useNetworkStatus } from './useNetworkStatus';
import { getDistancePreferences, getCachedPlace, cachePlace, getRecentPlaceIds } from '../services/storage';
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

  const fetchNearestPlace = async (skipCache: boolean = false) => {
    if (!userLocation || !category || !enabled) {
      return;
    }

    // Check network status before attempting fetch
    if (!isOnline) {
      setError(new Error('No internet connection. Please check your network and try again.'));
      setPlace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get distance preferences if user has purchased
      let distancePreferences = undefined;
      if (hasPurchased) {
        const preferences = await getDistancePreferences();
        if (preferences.enabled) {
          distancePreferences = preferences;
        }
      }

      // Get category preferences from context (set when category was selected)
      const currentCategoryPreferences = hasPurchased && categoryPreferences ? categoryPreferences : undefined;

      // Check cache first (unless explicitly skipping)
      if (!skipCache) {
        const cachedPlace = await getCachedPlace(category, userLocation, distancePreferences, currentCategoryPreferences);
        if (cachedPlace !== undefined) {
          // Check if cached place is in recent arrivals - if so, skip cache and fetch new
          if (cachedPlace && cachedPlace.placeId) {
            const recentPlaceIds = await getRecentPlaceIds();
            if (recentPlaceIds.includes(cachedPlace.placeId)) {
              // Cached place was already visited, skip cache and fetch new
              console.log(`Cached place ${cachedPlace.name} was already visited, fetching new place`);
            } else {
              // Cache hit and not in recent arrivals - use it
              setPlace(cachedPlace);
              fetchedCategoryRef.current = category;
              hasFetchedRef.current = true;
              initialLocationRef.current = userLocation;
              setLoading(false);
              return;
            }
          } else {
            // Cache hit but no place found (null) - use it
            setPlace(cachedPlace);
            fetchedCategoryRef.current = category;
            hasFetchedRef.current = true;
            initialLocationRef.current = userLocation;
            setLoading(false);
            return;
          }
        }
      }

      // Cache miss or skipCache - fetch from API
      const nearestPlace = await findNearestPlace(userLocation, category, distancePreferences, currentCategoryPreferences);
      setPlace(nearestPlace);
      
      // Cache the result
      await cachePlace(category, userLocation, nearestPlace, distancePreferences, currentCategoryPreferences);
      
      fetchedCategoryRef.current = category;
      hasFetchedRef.current = true;
      initialLocationRef.current = userLocation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to find nearest place');
      setError(error);
      setPlace(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if category preferences changed
    const categoryPrefsChanged = JSON.stringify(lastCategoryPreferencesRef.current) !== JSON.stringify(categoryPreferences);
    
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
    if ((categoryChanged || categoryPrefsChanged) && fetchedCategoryRef.current !== null) {
      setPlace(null);
      hasFetchedRef.current = false;
    }
    
    const shouldFetch = (hasLocationButNotFetched || categoryChanged || categoryPrefsChanged) && userLocation && category && enabled;
    
    if (shouldFetch) {
      lastCategoryPreferencesRef.current = categoryPreferences;
      fetchNearestPlace();
    }
  }, [category, enabled, userLocation, categoryPreferences]); // Include categoryPreferences to detect filter changes

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

