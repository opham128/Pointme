import { useState, useEffect } from 'react';
import { Location, Place, Category } from '../types';
import { findNearestPlace } from '../services/googlePlaces';

/**
 * Hook to find and track the nearest place of a given category
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

  const fetchNearestPlace = async () => {
    if (!userLocation || !category || !enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nearestPlace = await findNearestPlace(userLocation, category);
      setPlace(nearestPlace);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to find nearest place');
      setError(error);
      setPlace(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearestPlace();
  }, [userLocation, category, enabled]);

  return {
    place,
    loading,
    error,
    refetch: fetchNearestPlace,
  };
}

