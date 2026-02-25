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
  const { hasPurchased, categoryPreferences, searchTrigger } = useAppContext();

  // Simple ref to prevent duplicate fetches
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchKeyRef = useRef<string | null>(null);
  const lastFetchLocationRef = useRef<Location | null>(null);

  // Create a stable key for the current fetch request
  const getFetchKey = (cat: Category | null, loc: Location | null, prefs: any) => {
    if (!cat || !loc) return null;
    const prefsStr = JSON.stringify(prefs || null);
    return `${cat}-${loc.latitude.toFixed(4)}-${loc.longitude.toFixed(4)}-${prefsStr}`;
  };

  const fetchNearestPlace = async (skipCache: boolean = false) => {
    if (!userLocation || !category || !enabled || isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setError(null);
    if (!place || fetchedCategory !== category) {
      setLoading(true);
    }

    if (!isOnline) {
      isFetchingRef.current = false;
      setError(new Error('No internet connection. Please check your network and try again.'));
      setLoading(false);
      return;
    }

    const currentCategoryPreferences = hasPurchased && categoryPreferences ? categoryPreferences : undefined;
    const roundedLoc = roundLocationForCache(userLocation);

    try {
      if (!skipCache) {
        const cached = await getCachedPlace(category, roundedLoc, currentCategoryPreferences);
        if (cached !== undefined) {
          setPlace(cached);
          setFetchedCategory(category);
          setError(null);
          setLoading(false);
          isFetchingRef.current = false;
          lastFetchKeyRef.current = getFetchKey(category, userLocation, currentCategoryPreferences);
          lastFetchLocationRef.current = { ...userLocation };
          if (cached) {
            console.log('✅ Hook: Place from cache:', cached.name, 'for category:', category);
          }
          return;
        }
      }

      const nearestPlace = await findNearestPlace(userLocation, category, currentCategoryPreferences);

      setPlace(nearestPlace);
      setFetchedCategory(category);
      setError(null);
      setLoading(false);

      if (nearestPlace) {
        console.log('✅ Hook: Place found and set:', nearestPlace.name, 'for category:', category);
        await cachePlace(category, roundedLoc, nearestPlace, currentCategoryPreferences);
      } else {
        console.log('⚠️ Hook: No place found for category:', category);
      }

      isFetchingRef.current = false;
      lastFetchKeyRef.current = getFetchKey(category, userLocation, currentCategoryPreferences);
      lastFetchLocationRef.current = { ...userLocation };
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_CALL_BLOCKED') {
        isFetchingRef.current = false;
        return;
      }
      console.error('❌ fetchNearestPlace ERROR:', err);
      setError(err instanceof Error ? err : new Error('Failed to find nearest place'));
      setPlace(null);
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Run only when user has clicked a category (or Search) on HomeScreen — searchTrigger/category/prefs.
  // Query the endpoint only when: cache empty OR category changed OR user moved >50m since last fetch.
  useEffect(() => {
    if (!userLocation || !category || !enabled) {
      return;
    }

    const currentFetchKey = getFetchKey(category, userLocation, categoryPreferences);
    const movedSignificantly =
      lastFetchLocationRef.current != null &&
      calculateDistance(userLocation, lastFetchLocationRef.current) > 50;
    const categoryChanged = fetchedCategory !== category;
    const cacheEmpty = !place || fetchedCategory !== category;

    // Requery only if: cache empty, category changed, or moved >50m
    const shouldQuery = cacheEmpty || categoryChanged || movedSignificantly;

    if (!shouldQuery && currentFetchKey === lastFetchKeyRef.current && place && fetchedCategory === category) {
      return;
    }

    if (categoryChanged && fetchedCategory !== null) {
      console.log('[useNearestPlace] Category changed:', fetchedCategory, '->', category);
      setPlace(null);
      setFetchedCategory(null);
      setLoading(true);
      setError(null);
    }

    if (!isFetchingRef.current && shouldQuery) {
      lastFetchKeyRef.current = currentFetchKey;
      fetchNearestPlace(movedSignificantly);
    }
  }, [category, enabled, categoryPreferences, searchTrigger]);

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

  // SIMPLIFIED RETURN - if we have a place and category matches, return it
  // If category changed and we're fetching, show loading (not "no places found")
  const effectivePlace = (place && fetchedCategory === category) ? place : null;
  
  // If we're fetching for the current category, show loading
  // If category changed, we set loading=true in useEffect, so show that
  // Only show "no places" if we're not loading and don't have a place
  const effectiveLoading = isFetchingRef.current || loading;
  
  return {
    place: effectivePlace,
    loading: effectiveLoading,
    error,
    refetch: () => fetchNearestPlace(true),
  };
}
