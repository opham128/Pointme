import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Location as LocationType } from '../types';

/**
 * Hook to get and track user's current location
 * Handles permission requests and location updates
 * 
 * @param enabled Whether to actively track location
 * @returns User location, loading state, error, and permission status
 */
export function useLocation(enabled: boolean = true): {
  location: LocationType | null;
  loading: boolean;
  error: Error | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<void>;
} {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        setError(null);
      } else {
        setPermissionGranted(false);
        setError(new Error('Location permission denied'));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get location');
      setError(error);
      setPermissionGranted(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    requestPermission();

    // Watch for location updates
    let subscription: Location.LocationSubscription | null = null;

    const watchLocation = async () => {
      if (permissionGranted) {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000, // Update every second
            distanceInterval: 16, // Update every 16 feet (approximately 5 meters)
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            });
            setError(null);
          }
        );
      }
    };

    watchLocation();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [enabled, permissionGranted]);

  return {
    location,
    loading,
    error,
    permissionGranted,
    requestPermission,
  };
}

