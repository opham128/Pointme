import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { useHeading } from '../hooks/useHeading';
import { useNearestPlace } from '../hooks/useNearestPlace';
import { useDistance } from '../hooks/useDistance';
import { calculateBearing } from '../services/googlePlaces';
import { CompassNeedle } from '../components/CompassNeedle';
import { ARRIVAL_DISTANCE_THRESHOLD } from '../constants';
import { CATEGORIES } from '../constants';

export default function CompassScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { selectedCategory, userLocation, setTargetPlace } = useAppContext();
  const heading = useHeading(true);
  const { place, loading, error } = useNearestPlace(userLocation, selectedCategory, !!userLocation);
  const { distanceMeters, distanceFeet } = useDistance(userLocation, place?.location || null);
  const [hasArrived, setHasArrived] = useState(false);

  // Update target place in context
  useEffect(() => {
    if (place) {
      setTargetPlace(place);
    }
  }, [place, setTargetPlace]);

  // Check for arrival
  useEffect(() => {
    if (distanceMeters !== null && distanceMeters < ARRIVAL_DISTANCE_THRESHOLD && !hasArrived) {
      setHasArrived(true);
      // Navigate to arrival screen after a brief delay
      setTimeout(() => {
        router.push('/arrival');
      }, 500);
    }
  }, [distanceMeters, hasArrived]);

  // Calculate bearing from user to target
  const bearing = React.useMemo(() => {
    if (!userLocation || !place) return 0;
    return calculateBearing(userLocation, place.location);
  }, [userLocation, place]);

  // Calculate rotation angle for compass needle
  // The needle should point toward the target relative to device orientation
  // bearing: direction to target (0-360°, where 0 is North)
  // heading: device's current orientation (0-360°, where 0 is North)
  // rotation: how much to rotate the needle = bearing - heading
  // When rotation = 0, target is straight ahead
  // When rotation = 90, target is to the right
  // When rotation = -90, target is to the left
  const rotation = React.useMemo(() => {
    return bearing - heading;
  }, [bearing, heading]);

  if (!selectedCategory) {
    router.replace('/');
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
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
        <Text style={[styles.errorTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          No Places Found
        </Text>
        <Text style={[styles.errorText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
          {error?.message || 'Could not find any nearby places. Try a different category.'}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayDistance = distanceMeters
    ? distanceMeters < 1000
      ? `${Math.round(distanceMeters)}m (${Math.round(distanceFeet || 0)}ft)`
      : `${(distanceMeters / 1000).toFixed(2)}km`
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
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
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
});

