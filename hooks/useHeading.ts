import { useState, useEffect } from 'react';
import { Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';

/**
 * Hook to get device heading using magnetometer
 * Combines magnetometer data with GPS heading when available for better accuracy
 * 
 * @param enabled Whether to actively track heading
 * @returns Current heading in degrees (0-360, where 0 is North)
 */
export function useHeading(enabled: boolean = true): number {
  const [heading, setHeading] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;

    let subscription: any = null;
    let locationSubscription: any = null;

    // Try to get heading from GPS first (more accurate)
    const getLocationHeading = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
            },
            (location) => {
              if (location.coords.heading !== null && location.coords.heading !== undefined) {
                // GPS heading is more accurate, use it if available
                setHeading(location.coords.heading);
              }
            }
          );
        }
      } catch (error) {
        console.log('GPS heading not available, using magnetometer');
      }
    };

    // Fallback to magnetometer
    const setupMagnetometer = async () => {
      const isAvailable = await Magnetometer.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Magnetometer is not available on this device');
        return;
      }

      // Set update interval to 100ms for smooth compass updates
      Magnetometer.setUpdateInterval(100);

      subscription = Magnetometer.addListener((data) => {
        // Calculate heading from magnetometer data
        // atan2 gives angle in radians, convert to degrees
        let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        
        // Convert from -180 to 180 range to 0 to 360 range
        angle = (angle + 360) % 360;
        
        // Adjust for device orientation (assuming portrait mode)
        // In portrait, we need to account for the device's natural orientation
        angle = (angle + 90) % 360; // Adjust for portrait orientation
        
        setHeading(angle);
      });
    };

    getLocationHeading();
    setupMagnetometer();

    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [enabled]);

  return heading;
}

