import { useState, useEffect, useRef } from 'react';
import { Location, Place, Category } from '../types';
import { findNearestPlace } from '../services/googlePlaces';
import { useNetworkStatus } from './useNetworkStatus';
import { getDistancePreferences } from '../services/storage';
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
  const { hasPurchased } = useAppContext();
  
  // Track if we've already fetched for this category
  const fetchedCategoryRef = useRef<Category | null>(null);
  const hasFetchedRef = useRef<boolean>(false);
  const initialLocationRef = useRef<Location | null>(null);

  const fetchNearestPlace = async () => {
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

      const nearestPlace = await findNearestPlace(userLocation, category, distancePreferences);
      setPlace(nearestPlace);
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
    // Only fetch if:
    // 1. We have a location and category but haven't fetched yet, OR
    // 2. The category has changed (and we need to refetch for new category)
    const categoryChanged = fetchedCategoryRef.current !== category;
    const hasLocationButNotFetched = userLocation && !hasFetchedRef.current;
    
    // Reset place when category changes
    if (categoryChanged && fetchedCategoryRef.current !== null) {
      setPlace(null);
      hasFetchedRef.current = false;
    }
    
    const shouldFetch = (hasLocationButNotFetched || categoryChanged) && userLocation && category && enabled;
    
    if (shouldFetch) {
      fetchNearestPlace();
    }
  }, [category, enabled, userLocation]); // userLocation needed for initial fetch, but refs prevent refetching on updates

  // Auto-retry when coming back online after an error
  useEffect(() => {
    if (isOnline && error && userLocation && category && enabled) {
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
    refetch: fetchNearestPlace,
  };
}

