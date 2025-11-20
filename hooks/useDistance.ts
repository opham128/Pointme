import { useState, useEffect } from 'react';
import { Location } from '../types';
import { calculateDistance } from '../services/googlePlaces';

/**
 * Hook to calculate and track distance between two locations
 * Updates automatically when locations change
 * 
 * @param from Starting location
 * @param to Target location
 * @returns Distance in meters and feet
 */
export function useDistance(
  from: Location | null,
  to: Location | null
): {
  distanceMeters: number | null;
  distanceFeet: number | null;
} {
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [distanceFeet, setDistanceFeet] = useState<number | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setDistanceMeters(null);
      setDistanceFeet(null);
      return;
    }

    const distance = calculateDistance(from, to);
    setDistanceMeters(distance);
    setDistanceFeet(distance * 3.28084); // Convert meters to feet
  }, [from, to]);

  return {
    distanceMeters,
    distanceFeet,
  };
}

