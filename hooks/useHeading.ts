import React, { useState, useEffect } from 'react';
import * as Location from 'expo-location';

/**
 * Hook to get device heading using expo-location's watchHeadingAsync
 * This uses Core Location's CLLocationManager.startUpdatingHeading() under the hood
 * Matches the working implementation exactly
 * 
 * @param enabled Whether to actively track heading
 * @returns Current heading in degrees (0-360, where 0 is North - magnetic north)
 */
export function useHeading(enabled: boolean = true): number {
  const [heading, setHeading] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;

    let subscription: any = null;

    const setupHeading = async () => {
      try {
        // Request location permissions (required for heading on iOS)
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission not granted, cannot get compass heading');
          return;
        }

        // Use watchHeadingAsync - this directly uses CLLocationManager.startUpdatingHeading()
        subscription = await Location.watchHeadingAsync((newHeading) => {
          // Get magHeading from LocationHeadingObject
          // Standard compass: 0° = North, 90° = East (right), 180° = South, 270° = West (left)
          const degrees = newHeading.magHeading;
          
          // Normalize to 0-360 range (should already be in this range, but ensure it)
          const normalizedDegrees = degrees < 0 ? degrees + 360 : degrees;
          
          setHeading(normalizedDegrees);
        });
      } catch (error) {
        console.error('Error setting up compass heading:', error);
      }
    };

    setupHeading();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [enabled]);

  return heading;
}
