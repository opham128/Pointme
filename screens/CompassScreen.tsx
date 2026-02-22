import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useAppContext } from '../context/AppContext';
import { useHeading } from '../hooks/useHeading';
import { useNearestPlace } from '../hooks/useNearestPlace';
import { useDistance } from '../hooks/useDistance';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { calculateBearing } from '../services/mapboxPlaces';
import { CompassNeedle } from '../components/CompassNeedle';
import { ARRIVAL_DISTANCE_THRESHOLD, FREE_LOCATIONS_LIMIT } from '../constants';
import { CATEGORIES } from '../constants';
import { getDistanceUnit, saveDistanceUnit, DistanceUnit } from '../services/storage';

export default function CompassScreen() {
  const isDark = true; // Always dark mode
  const router = useRouter();
  const { selectedCategory, userLocation, setTargetPlace, arrivalCount, hasPurchased } = useAppContext();
  const heading = useHeading(true);
  const { place, loading, error, refetch } = useNearestPlace(userLocation, selectedCategory, !!userLocation);
  console.log('📍 CompassScreen received from hook:', {
    place: place ? place.name : null,
    loading,
    error: error ? error.message : null,
    timestamp: new Date().toISOString(),
  });
  const { distanceFeet, distanceMiles } = useDistance(userLocation, place?.location || null);
  const isOnline = useNetworkStatus();
  const [hasArrived, setHasArrived] = useState(false);
  const hasAlignedRef = useRef(false); // Track if we've already triggered alignment haptic
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('feet');
  const lastHapticTimeRef = useRef<number>(0);
  
  // Pulsing glow animation for when close
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  
  // Load distance unit preference
  useEffect(() => {
    getDistanceUnit().then(setDistanceUnit);
  }, []);
  
  // Debug: simulate close distance for testing
  const [debugCloseDistance, setDebugCloseDistance] = useState<number | null>(null);
  
  // Pulse animation and haptics when close (within 200 feet)
  const CLOSE_DISTANCE_THRESHOLD = 200; // feet
  const effectiveDistance = debugCloseDistance !== null ? debugCloseDistance : distanceFeet;
  
  useEffect(() => {
    if (!effectiveDistance || effectiveDistance > CLOSE_DISTANCE_THRESHOLD || hasArrived) {
      // Stop pulsing if too far or arrived
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0.3, { duration: 200 });
      return;
    }
    
    // Start pulsing - intensity increases as you get closer
    const distanceRatio = 1 - (effectiveDistance / CLOSE_DISTANCE_THRESHOLD); // 0 to 1
    const pulseIntensity = 0.3 + (distanceRatio * 0.4); // 0.3 to 0.7 opacity
    const pulseSpeed = 800 - (distanceRatio * 400); // 800ms to 400ms (faster when closer)
    
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: pulseSpeed / 2, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: pulseSpeed / 2, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(pulseIntensity, { duration: pulseSpeed / 2, easing: Easing.out(Easing.ease) }),
        withTiming(0.3, { duration: pulseSpeed / 2, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    
    // Pulse haptic feedback (every 1.5 seconds when close)
    const now = Date.now();
    if (now - lastHapticTimeRef.current > 1500) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastHapticTimeRef.current = now;
    }
  }, [effectiveDistance, hasArrived]);

  // Update target place in context
  useEffect(() => {
    if (place) {
      setTargetPlace(place);
    }
  }, [place, setTargetPlace]);

  // Check for arrival (ARRIVAL_DISTANCE_THRESHOLD is in feet)
  useEffect(() => {
    if (distanceFeet !== null && distanceFeet < ARRIVAL_DISTANCE_THRESHOLD && !hasArrived) {
      setHasArrived(true);
      // Haptic feedback for arrival
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to arrival screen after a brief delay
      setTimeout(() => {
        router.push('/arrival');
      }, 500);
    }
  }, [distanceFeet, hasArrived, router]);

  // Redirect if no category selected
  useEffect(() => {
    if (!selectedCategory) {
      router.replace('/');
    }
  }, [selectedCategory, router]);

  // Debug logging for loading state (MUST be before any conditional returns)
  useEffect(() => {
    console.log('🎯 CompassScreen render - loading state:', {
      loading,
      hasPlace: !!place,
      placeName: place ? place.name : null,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    });
  }, [loading, place, error]);

  // Calculate bearing from user to target location
  const bearing = useMemo(() => {
    if (!userLocation || !place) return 0;
    return calculateBearing(userLocation, place.location);
  }, [userLocation?.latitude, userLocation?.longitude, place?.location.latitude, place?.location.longitude]);

  // Calculate rotation angle for compass needle to point toward target
  // bearing: direction to target (0-360°, where 0 is North)
  // heading: device's current orientation (0-360°, where 0 is North)
  // rotation: how much to rotate the needle = bearing - heading
  // When rotation = 0, target is straight ahead
  // When rotation = 90, target is to the right
  // When rotation = -90, target is to the left
  const rotation = useMemo(() => {
    if (!place) return 0;
    
    let diff = bearing - heading;
    
    // Normalize to -180 to 180 range for shortest rotation path
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    
    return diff;
  }, [bearing, heading, place]);

  // Haptic feedback when heading aligns with bearing (pointing in the right direction)
  useEffect(() => {
    if (!place || hasArrived) return;

    // Check if heading and bearing are aligned (within 5 degrees)
    const alignmentThreshold = 5;
    const angleDiff = Math.abs(rotation);
    
    if (angleDiff <= alignmentThreshold) {
      // Only trigger haptic once when we first align
      if (!hasAlignedRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        hasAlignedRef.current = true;
      }
    } else {
      // Reset the flag when we're no longer aligned
      hasAlignedRef.current = false;
    }
  }, [rotation, place, hasArrived]);

  // Convert distance for display based on unit preference
  // All calculations still use feet internally (distanceFeet stays in feet)
  // MUST be called before any conditional returns (Rules of Hooks)
  const displayDistance = useMemo(() => {
    if (!distanceFeet) return '--';
    
    if (distanceUnit === 'meters') {
      const distanceMeters = distanceFeet * 0.3048; // Convert feet to meters
      if (distanceMeters < 1000) {
        return `${Math.round(distanceMeters)}m`;
      } else {
        const distanceKm = distanceMeters / 1000;
        return `${distanceKm.toFixed(2)}km`;
      }
    } else {
      // Default to feet/miles
      if (distanceFeet < 5280) { // Less than 1 mile
        return `${Math.round(distanceFeet)}ft`;
      } else {
        return `${distanceMiles?.toFixed(2) || (distanceFeet / 5280).toFixed(2)}mi`;
      }
    }
  }, [distanceFeet, distanceMiles, distanceUnit]);
  
  // Toggle distance unit
  const handleToggleUnit = async () => {
    const newUnit: DistanceUnit = distanceUnit === 'feet' ? 'meters' : 'feet';
    setDistanceUnit(newUnit);
    await saveDistanceUnit(newUnit);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!selectedCategory) {
    return null;
  }

  // Defensive check: if we have a place, don't show loading even if loading is true
  // This prevents stuck loading screen when state updates are out of sync
  console.log('🔍 CompassScreen render check:', {
    loading,
    hasPlace: !!place,
    placeName: place ? place.name : null,
    selectedCategory,
    timestamp: new Date().toISOString(),
  });
  
  if (loading && !place) {
    console.log('⏸️ CompassScreen showing loading screen - loading:', loading, 'hasPlace:', !!place);
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>
          Finding nearest {CATEGORIES[selectedCategory].label.toLowerCase()}...
        </Text>
      </View>
    );
  }

  if (error || !place) {
    // Don't show error if we're still loading (might be a duplicate call issue)
    if (loading) {
      return (
        <View style={[styles.container, { backgroundColor: '#000000' }]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>
            Finding nearest {CATEGORIES[selectedCategory].label.toLowerCase()}...
          </Text>
        </View>
      );
    }
    
    const isOfflineError = error?.message?.toLowerCase().includes('internet') || 
                          error?.message?.toLowerCase().includes('network') ||
                          !isOnline;
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <Text style={[styles.errorTitle, { color: '#FFFFFF' }]}>
          {isOfflineError ? 'No Internet Connection' : 'No Places Found'}
        </Text>
        <Text style={[styles.errorText, { color: '#8E8E93' }]}>
          {isOfflineError 
            ? 'Please check your internet connection and try again.'
            : error?.message || 'Could not find any nearby places. Try a different category.'}
        </Text>
        <View style={styles.buttonRow}>
          {isOfflineError && (
            <TouchableOpacity
              style={[styles.button, styles.retryButton, { backgroundColor: '#007AFF' }]}
              onPress={() => refetch()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#2C2C2E' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      {/* Compass */}
      <View style={styles.compassContainer}>
        <CompassNeedle 
          rotation={rotation} 
          pulseScale={pulseScale}
          pulseOpacity={pulseOpacity}
        />
      </View>

      {/* Info Panel */}
      <View style={styles.infoContainer}>
        <Text
          style={[styles.distanceText, { color: '#FFFFFF' }]}
          numberOfLines={1}
        >
          {displayDistance}
        </Text>
        
        {/* Blurred target name until arrival */}
        <Text
          style={[
            styles.targetName,
            {
              color: '#8E8E93',
              opacity: hasArrived ? 1 : 0.3,
            },
          ]}
          numberOfLines={1}
        >
          {hasArrived ? place.name : '••••••••'}
        </Text>

        {/* Heading info */}
        <View style={styles.headingInfo}>
          <Text style={[styles.headingLabel, { color: '#8E8E93' }]}>
            Heading: {Math.round(heading)}°
          </Text>
          <Text style={[styles.headingLabel, { color: '#8E8E93' }]}>
            Bearing: {Math.round(bearing)}°
          </Text>
        </View>
      </View>

      {/* Test Buttons (for testing) */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#FF9500' }]}
            onPress={() => {
              setHasArrived(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.push('/arrival');
            }}
          >
            <Text style={styles.testButtonText}>🧪 Test Arrival</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#007AFF' }]}
            onPress={() => {
              if (debugCloseDistance === null) {
                setDebugCloseDistance(100); // Simulate 100 feet away
              } else {
                setDebugCloseDistance(null); // Reset to actual distance
              }
            }}
          >
            <Text style={styles.testButtonText}>
              {debugCloseDistance !== null ? '📍 Stop Pulse Test' : '📍 Test Pulse (100ft)'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: '#2C2C2E' }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backButtonText, { color: '#FFFFFF' }]}>
          Choose Another
        </Text>
      </TouchableOpacity>
      
      {/* Distance unit toggle button (bottom right) */}
      <TouchableOpacity
        style={[styles.unitToggleButton, { backgroundColor: '#2C2C2E' }]}
        onPress={handleToggleUnit}
      >
        <Text style={[styles.unitToggleText, { color: '#FFFFFF' }]}>
          ft/m
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  compassContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  distanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  targetName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  headingInfo: {
    flexDirection: 'row',
    gap: 20,
  },
  headingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButton: {
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    gap: 12,
    marginBottom: 12,
  },
  testButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 40,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  unitToggleButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

