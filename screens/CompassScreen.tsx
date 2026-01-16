import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { useHeading } from '../hooks/useHeading';
import { useNearestPlace } from '../hooks/useNearestPlace';
import { useDistance } from '../hooks/useDistance';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { calculateBearing } from '../services/googlePlaces';
import { CompassNeedle } from '../components/CompassNeedle';
import { ARRIVAL_DISTANCE_THRESHOLD, FREE_LOCATIONS_LIMIT } from '../constants';
import { CATEGORIES } from '../constants';

export default function CompassScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { selectedCategory, userLocation, setTargetPlace, arrivalCount, hasPurchased } = useAppContext();
  const heading = useHeading(true);
  const { place, loading, error, refetch } = useNearestPlace(userLocation, selectedCategory, !!userLocation);
  const { distanceFeet, distanceMiles } = useDistance(userLocation, place?.location || null);
  const isOnline = useNetworkStatus();
  const [hasArrived, setHasArrived] = useState(false);
  const hasAlignedRef = useRef(false); // Track if we've already triggered alignment haptic

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

  // Calculate bearing from user to target location
  const bearing = React.useMemo(() => {
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
  const rotation = React.useMemo(() => {
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

  if (!selectedCategory) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#000000'} />
        <Text style={[styles.loadingText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Finding nearest {CATEGORIES[selectedCategory].label.toLowerCase()}...
        </Text>
      </View>
    );
  }

  if (error || !place) {
    const isOfflineError = error?.message?.toLowerCase().includes('internet') || 
                          error?.message?.toLowerCase().includes('network') ||
                          !isOnline;
    
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
        <Text style={[styles.errorTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          {isOfflineError ? 'No Internet Connection' : 'No Places Found'}
        </Text>
        <Text style={[styles.errorText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
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
            style={[styles.button, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayDistance = distanceFeet
    ? distanceFeet < 5280 // Less than 1 mile (5280 feet)
      ? `${Math.round(distanceFeet)}ft`
      : `${distanceMiles?.toFixed(2) || (distanceFeet / 5280).toFixed(2)}mi`
    : '--';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      {/* Compass */}
      <View style={styles.compassContainer}>
        <CompassNeedle rotation={rotation} />
      </View>

      {/* Info Panel */}
      <View style={styles.infoContainer}>
        <Text
          style={[styles.distanceText, { color: isDark ? '#FFFFFF' : '#000000' }]}
          numberOfLines={1}
        >
          {displayDistance}
        </Text>
        
        {/* Blurred target name until arrival */}
        <Text
          style={[
            styles.targetName,
            {
              color: isDark ? '#8E8E93' : '#6E6E73',
              opacity: hasArrived ? 1 : 0.3,
            },
          ]}
          numberOfLines={1}
        >
          {hasArrived ? place.name : '••••••••'}
        </Text>

        {/* Heading info */}
        <View style={styles.headingInfo}>
          <Text style={[styles.headingLabel, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
            Heading: {Math.round(heading)}°
          </Text>
          <Text style={[styles.headingLabel, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
            Bearing: {Math.round(bearing)}°
          </Text>
        </View>
      </View>

      {/* Test Arrival Button (for testing) */}
      {__DEV__ && (
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
      )}

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Choose Another
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
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 40,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

