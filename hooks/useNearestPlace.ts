import { useState, useEffect, useRef } from 'react';
import { Location, Place, Category } from '../types';
import { findNearestPlace } from '../services/mapboxPlaces';
import { useNetworkStatus } from './useNetworkStatus';
import { getCachedPlace, getCachedPlaces, cachePlace, cachePlaces, getRecentPlaceIds, clearCacheEntry } from '../services/storage';
import { calculateDistance } from '../services/mapboxPlaces';
import { useAppContext } from '../context/AppContext';

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
  const [fetchedCategory, setFetchedCategory] = useState<Category | null>(null);
  
  const isOnline = useNetworkStatus();
  const { hasPurchased, categoryPreferences } = useAppContext();
  
  // Simple refs to prevent duplicate fetches
  const isFetchingRef = useRef<boolean>(false);
  const lastLocationRef = useRef<Location | null>(null);
  const lastCategoryPrefsRef = useRef<string>('');

  const fetchNearestPlace = async (skipCache: boolean = false) => {
    if (!userLocation || !category || !enabled || isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    if (!isOnline) {
      isFetchingRef.current = false;
      setError(new Error('No internet connection. Please check your network and try again.'));
      setLoading(false);
      return;
    }

    try {
      const currentCategoryPreferences = hasPurchased && categoryPreferences ? categoryPreferences : undefined;

      // Check cache first
      if (!skipCache) {
        const roundedLocation = roundLocationForCache(userLocation);
        const cachedPlaces = await getCachedPlaces(category, roundedLocation, currentCategoryPreferences);
        if (cachedPlaces !== undefined) {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const cacheData = await AsyncStorage.getItem('@pointme:place_cache');
          
          if (cacheData) {
            const cache: Record<string, any> = JSON.parse(cacheData);
            const cacheKey = getCacheKey(category, roundedLocation, currentCategoryPreferences);
            const cached = cache[cacheKey];
            
            if (cached && cached.location) {
              const MAX_CACHE_DISTANCE_METERS = 500;
              const distanceFromCachedLocation = calculateDistance(userLocation, cached.location);
              
              if (distanceFromCachedLocation > MAX_CACHE_DISTANCE_METERS) {
                await clearCacheEntry(category, roundedLocation, currentCategoryPreferences);
              } else {
                const recentPlaceIds = await getRecentPlaceIds();
                const unvisitedPlaces = cachedPlaces.filter(place => 
                  place && place.placeId && !recentPlaceIds.includes(place.placeId)
                );
                
                if (unvisitedPlaces.length > 0) {
                  const nearestUnvisited = unvisitedPlaces[0];
                  setPlace(nearestUnvisited);
                  setFetchedCategory(category);
                  setLoading(false);
                  isFetchingRef.current = false;
                  lastLocationRef.current = userLocation;
                  lastCategoryPrefsRef.current = JSON.stringify(categoryPreferences || null);
                  return;
                } else if (cachedPlaces.length === 0) {
                  setPlace(null);
                  setFetchedCategory(category);
                  setLoading(false);
                  isFetchingRef.current = false;
                  lastLocationRef.current = userLocation;
                  lastCategoryPrefsRef.current = JSON.stringify(categoryPreferences || null);
                  return;
                } else {
                  await clearCacheEntry(category, roundedLocation, currentCategoryPreferences);
                }
              }
            }
          }
        }
      }

      const nearestPlace = await findNearestPlace(userLocation, category, currentCategoryPreferences);
      
      setPlace(nearestPlace);
      setFetchedCategory(category);
      setError(null);
      setLoading(false);
      
      if (nearestPlace) {
        const allPlaces = (nearestPlace as any)._allPlaces || [nearestPlace];
        cachePlaces(category, userLocation, allPlaces, currentCategoryPreferences).catch(() => {});
      }
      
      lastLocationRef.current = userLocation;
      lastCategoryPrefsRef.current = JSON.stringify(categoryPreferences || null);
      isFetchingRef.current = false;
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_CALL_BLOCKED') {
        isFetchingRef.current = false;
        return;
      }
      
      const error = err instanceof Error ? err : new Error('Failed to find nearest place');
      setError(error);
      setPlace(null);
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Main effect: fetch when category/location changes
  useEffect(() => {
    if (!userLocation || !category || !enabled) {
      return;
    }

    // If we already have a place for this category, don't fetch again
    if (place && fetchedCategory === category) {
      if (loading) {
        setLoading(false);
      }
      return;
    }

    // If category changed, clear the place
    if (fetchedCategory !== null && fetchedCategory !== category) {
      setPlace(null);
      setFetchedCategory(null);
    }

    // Check if we need to fetch
    const categoryPrefsStr = JSON.stringify(categoryPreferences || null);
    const needsFetch = 
      !fetchedCategory || 
      fetchedCategory !== category ||
      categoryPrefsStr !== lastCategoryPrefsRef.current ||
      !lastLocationRef.current ||
      (lastLocationRef.current && calculateDistance(userLocation, lastLocationRef.current) > 50);

    if (needsFetch && !isFetchingRef.current) {
      fetchNearestPlace();
    }
  }, [category, enabled, categoryPreferences, userLocation?.latitude, userLocation?.longitude]);

  // Auto-retry when coming back online
  useEffect(() => {
    if (isOnline && error && userLocation && category && enabled) {
      const errorIsAuth = error.message?.toLowerCase().includes('auth') || 
                          error.message?.toLowerCase().includes('token') ||
                          error.message?.toLowerCase().includes('authentication');
      if (errorIsAuth) {
        return;
      }
      
      const errorIsOffline = error.message?.toLowerCase().includes('internet') || 
                            error.message?.toLowerCase().includes('network');
      if (errorIsOffline && !isFetchingRef.current) {
        fetchNearestPlace();
      }
    }
  }, [isOnline, error, userLocation, category, enabled]);

  // Simple return: if we have a place for current category, return it. Otherwise return null.
  const effectivePlace = (place && fetchedCategory === category) ? place : null;
  const effectiveLoading = effectivePlace ? false : loading;

  return {
    place: effectivePlace,
    loading: effectiveLoading,
    error,
    refetch: () => fetchNearestPlace(true),
  };
}
