import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Location as LocationType } from '../types';

/**
 * Hook to get and track user's current location
 * Handles permission requests and location updates
 * 
 * IMPORTANT: This hook does NOT request permission on mount.
 * Call requestPermission() when the user presses "Locate Me" button.
 * 
 * @param enabled Whether to actively track location (watches for updates if permission already granted)
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
  const [loading, setLoading] = useState<boolean>(false); // Start as false (not loading)
  const [error, setError] = useState<Error | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const requestPermission = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
        
        // First, try to get a quick location (lower accuracy, faster)
        // This prevents long waits when navigating back to home screen
        try {
          const quickLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation({
            latitude: quickLocation.coords.latitude,
            longitude: quickLocation.coords.longitude,
          });
          setLoading(false); // Set loading to false immediately with quick location
          setError(null);
        } catch (quickError) {
          // If quick location fails, fall back to high accuracy
          console.log('Quick location failed, using high accuracy');
        }
        
        // Then get high accuracy location in background (for compass/navigation)
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        setError(null);
        setLoading(false);
      } else {
        setPermissionGranted(false);
        setError(new Error('Location permission denied'));
        setLoading(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get location');
      setError(error);
      setPermissionGranted(false);
      setLoading(false);
    }
  };

  // Only watch location if enabled AND permission is already granted
  // Does NOT auto-request permission
  useEffect(() => {
    if (!enabled || !permissionGranted) return;

    // Watch for location updates
    let subscription: Location.LocationSubscription | null = null;

    const watchLocation = async () => {
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

