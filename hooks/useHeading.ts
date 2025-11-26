import React, { useState, useEffect, useRef } from 'react';
import { Magnetometer } from 'expo-sensors';

/**
 * Hook to get device heading using magnetometer
 * Simple, reliable implementation that works on iOS and Android
 * 
 * @param enabled Whether to actively track heading
 * @returns Current heading in degrees (0-360, where 0 is North)
 */
export function useHeading(enabled: boolean = true): number {
  const [heading, setHeading] = useState<number>(0);
  const smoothedHeadingRef = useRef<number>(0);
  const lastRawHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let subscription: any = null;

    const setupMagnetometer = async () => {
      const isAvailable = await Magnetometer.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Magnetometer is not available on this device');
        return;
      }

      // Set update interval to 50ms for responsive updates
      Magnetometer.setUpdateInterval(50);

      subscription = Magnetometer.addListener((data) => {
        // Calculate raw heading from magnetometer data
        // atan2(y, x) gives angle in radians, convert to degrees
        let rawAngle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        
        // Convert from -180 to 180 range to 0 to 360 range
        rawAngle = rawAngle < 0 ? rawAngle + 360 : rawAngle;
        
        // Transform to compass heading where 0° = North
        // Expo magnetometer: when pointing North, y is max, x is ~0
        // atan2(max, 0) = 90°, so we subtract 90° to get 0° for North
        let compassHeading = (rawAngle - 90 + 360) % 360;
        
        // Filter out noise: if change is too large, it's likely interference
        if (lastRawHeadingRef.current !== null) {
          let diff = Math.abs(compassHeading - lastRawHeadingRef.current);
          // Handle wrap-around
          if (diff > 180) {
            diff = 360 - diff;
          }
          // If change > 60°, it's likely noise - ignore it
          if (diff > 60) {
            compassHeading = lastRawHeadingRef.current;
          }
        }
        
        lastRawHeadingRef.current = compassHeading;
        
        // Apply exponential smoothing for Apple-like smooth rotation
        // This reduces jitter while maintaining responsiveness
        const smoothingFactor = 0.2; // 0-1, lower = smoother but slower
        smoothedHeadingRef.current = 
          smoothedHeadingRef.current * (1 - smoothingFactor) + 
          compassHeading * smoothingFactor;
        
        // Handle wrap-around in smoothing (e.g., 359° to 1°)
        let smoothed = smoothedHeadingRef.current;
        if (lastRawHeadingRef.current !== null) {
          const rawDiff = Math.abs(compassHeading - smoothed);
          if (rawDiff > 180) {
            // We crossed the 0/360 boundary
            if (compassHeading < 180) {
              smoothed = (smoothed - 360) * (1 - smoothingFactor) + compassHeading * smoothingFactor;
              if (smoothed < 0) smoothed += 360;
            } else {
              smoothed = (smoothed + 360) * (1 - smoothingFactor) + compassHeading * smoothingFactor;
              if (smoothed >= 360) smoothed -= 360;
            }
            smoothedHeadingRef.current = smoothed;
          }
        }
        
        // Normalize to 0-360
        smoothedHeadingRef.current = ((smoothedHeadingRef.current % 360) + 360) % 360;
        
        setHeading(smoothedHeadingRef.current);
      });
    };

    setupMagnetometer();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [enabled]);

  return heading;
}
