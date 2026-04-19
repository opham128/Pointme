import { useState, useEffect, useRef } from 'react';
import { Location } from '../types';
import { calculateDistance } from '../services/mapboxPlaces';

/**
 * Hook to calculate and track distance between two locations
 * Updates automatically when locations change and periodically for smoother updates
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
  const intervalRef = useRef<number | null>(null);

  const calculateAndSetDistance = () => {
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
  };

  useEffect(() => {
    // Calculate immediately when locations change
    calculateAndSetDistance();

    // Set up periodic updates every 2 seconds for smoother distance display
    if (from && to) {
      intervalRef.current = setInterval(calculateAndSetDistance, 2000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [from?.latitude, from?.longitude, to?.latitude, to?.longitude]);

  return {
    distanceFeet,
    distanceMiles,
  };
}

