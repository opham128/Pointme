import { useState, useEffect } from 'react';
import { Location } from '../types';
import { calculateDistance } from '../services/mapboxPlaces';

/**
 * Hook to calculate and track distance between two locations
 * Updates automatically when locations change
 * 
 * @param from Starting location
 * @param to Target location
 * @returns Distance in feet and miles
 */
export function useDistance(
  from: Location | null,
  to: Location | null
): {
  distanceFeet: number | null;
  distanceMiles: number | null;
} {
  const [distanceFeet, setDistanceFeet] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setDistanceFeet(null);
      setDistanceMiles(null);
      return;
    }

    const distanceMeters = calculateDistance(from, to);
    const feet = distanceMeters * 3.28084; // Convert meters to feet
    const miles = feet / 5280; // Convert feet to miles
    
    setDistanceFeet(feet);
    setDistanceMiles(miles);
  }, [from, to]);

  return {
    distanceFeet,
    distanceMiles,
  };
}

