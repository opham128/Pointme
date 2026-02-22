import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { ConfettiAnimation } from '../components/ConfettiAnimation';
import { addArrival, clearCacheEntry } from '../services/storage';
import { FREE_LOCATIONS_LIMIT } from '../constants';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default function ArrivalScreen() {
  const isDark = true; // Always dark mode
  const router = useRouter();
  const { targetPlace, setSelectedCategory, setTargetPlace, refreshHistory, arrivalCount, hasPurchased, setCategoryPreferences, selectedCategory, userLocation, categoryPreferences } = useAppContext();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [hasSavedArrival, setHasSavedArrival] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const hasAnimatedRef = React.useRef(false);
  
  // Staggered animation values
  const photoScale = useSharedValue(0.95);
  const photoOpacity = useSharedValue(0);
  const arrivalScale = useSharedValue(0.9);
  const arrivalTranslateY = useSharedValue(10);
  const arrivalOpacity = useSharedValue(0);
  const placeNameTranslateY = useSharedValue(8);
  const placeNameOpacity = useSharedValue(0);

  // Save arrival and trigger animations - only once when targetPlace is set
  useEffect(() => {
    if (!targetPlace) return;

    // Save arrival to history (allow 5th arrival, paywall shows when selecting new category)
    if (!hasSavedArrival) {
      addArrival(targetPlace).then(async () => {
        refreshHistory();
        setHasSavedArrival(true);
        
        // Clear cache for this category/location since arrival happened
        // This ensures next query is fresh (location may have changed)
        if (selectedCategory && userLocation) {
          const currentCategoryPreferences = hasPurchased && categoryPreferences ? categoryPreferences : undefined;
          
          // Round location to match cache key format
          const roundLocationForCache = (loc: { latitude: number; longitude: number }) => ({
            latitude: Math.round(loc.latitude * 1000) / 1000,
            longitude: Math.round(loc.longitude * 1000) / 1000,
          });
          
          await clearCacheEntry(selectedCategory, roundLocationForCache(userLocation), currentCategoryPreferences);
        }
      });
    }
  }, [targetPlace, hasSavedArrival]);

  // Trigger animations when images are ready (or immediately if no photos)
  useEffect(() => {
    if (!targetPlace) return;
    
    // Wait for images to load if photos exist, otherwise animate immediately
    const shouldAnimate = !targetPlace.photos || targetPlace.photos.length === 0 || imagesReady;
    
    if (shouldAnimate && !hasAnimatedRef.current) {
      // Haptic feedback for arrival (success notification)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Trigger confetti immediately
      setConfettiTrigger(1);

      // Staggered animations for polish
      // Photo: scale + fade (0ms delay)
      photoScale.value = withSequence(
        withSpring(1.05, { damping: 14, stiffness: 180 }),
        withTiming(1, { duration: 120 })
      );
      photoOpacity.value = withTiming(1, { duration: 300 });

      // "You've Arrived!" text: bounce + upward motion (80ms delay)
      setTimeout(() => {
        arrivalScale.value = withSequence(
          withSpring(1.1, { damping: 14, stiffness: 180 }),
          withTiming(1, { duration: 120 })
        );
        arrivalTranslateY.value = withSequence(
          withTiming(0, { duration: 250 }),
          withTiming(-4, { duration: 120 }),
          withTiming(0, { duration: 120 })
        );
        arrivalOpacity.value = withTiming(1, { duration: 300 });
      }, 80);

      // Place name: fade + slide (160ms delay)
      setTimeout(() => {
        placeNameTranslateY.value = withTiming(0, { duration: 400 });
        placeNameOpacity.value = withTiming(1, { duration: 400 });
      }, 160);
      
      hasAnimatedRef.current = true;
    }
  }, [targetPlace, imagesReady]);

  // Redirect if no target place
  useEffect(() => {
    if (!targetPlace) {
      router.replace('/');
    }
  }, [targetPlace, router]);

  // Animated styles for staggered content
  const photoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoScale.value }],
    opacity: photoOpacity.value,
  }));

  const arrivalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: arrivalScale.value },
      { translateY: arrivalTranslateY.value }
    ],
    opacity: arrivalOpacity.value,
  }));

  const placeNameAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: placeNameTranslateY.value }],
    opacity: placeNameOpacity.value,
  }));

  const handleOpenInMaps = async () => {
    if (!targetPlace) return;

    const { latitude, longitude } = targetPlace.location;
    const placeName = encodeURIComponent(targetPlace.name);
    
    // Use web URL that works through Safari
    let webUrl: string;
    if (targetPlace.placeId) {
      webUrl = `https://www.google.com/maps/search/?api=1&query=${placeName}&query_place_id=${targetPlace.placeId}`;
    } else {
      webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    
    Linking.openURL(webUrl).catch((err) => {
      console.error('Failed to open Google Maps:', err);
    });
  };

  const handleChooseAnother = () => {
    setSelectedCategory(null);
    setTargetPlace(null);
    setCategoryPreferences(null);
    router.replace('/');
  };

  if (!targetPlace) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <ConfettiAnimation trigger={confettiTrigger} />

      <View style={styles.content}>
        {/* Photo Gallery */}
        {/* Google Places Photo API code (commented out - for reference if switching back to Google):
         * Photos were fetched from Google Places API using:
         * const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
         * 
         * The photo_reference came from the place's photos array in the Google Places API response.
         * Up to 3 photos were fetched per place, but we reduced it to 1 photo per place for cost optimization.
         */}
        {targetPlace.photos && targetPlace.photos.length > 0 ? (
          <Animated.View style={[styles.photoContainer, photoAnimatedStyle]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.photoScrollView}
              contentContainerStyle={styles.photoScrollContent}
            >
              {targetPlace.photos.map((photoUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: photoUrl }}
                  style={styles.placePhoto}
                  resizeMode="cover"
                  onLoadEnd={() => {
                    if (index === 0) {
                      setImagesReady(true);
                    }
                  }}
                />
              ))}
            </ScrollView>
            {targetPlace.photos.length > 1 && (
              <View style={styles.photoIndicatorContainer}>
                {targetPlace.photos.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.photoIndicator,
                      { backgroundColor: 'rgba(255,255,255,0.5)' },
                    ]}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.placeholderPhoto, { backgroundColor: '#2C2C2E' }, photoAnimatedStyle]}>
            <Text style={[styles.placeholderEmoji, { color: '#8E8E93' }]}>
              📍
            </Text>
          </Animated.View>
        )}
        
        <Animated.Text style={[styles.arrivalText, { color: '#FFFFFF' }, arrivalAnimatedStyle]}>
          You've Arrived!
        </Animated.Text>

        <View style={styles.placeInfo}>
          <Animated.Text style={[styles.placeName, { color: '#FFFFFF' }, placeNameAnimatedStyle]}>
            {targetPlace.name}
          </Animated.Text>
          {targetPlace.address && (
            <Animated.Text style={[styles.placeAddress, { color: '#8E8E93' }, placeNameAnimatedStyle]}>
              {targetPlace.address}
            </Animated.Text>
          )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, { backgroundColor: '#007AFF' }]}
          onPress={handleOpenInMaps}
        >
          <Text style={styles.primaryButtonText}>Open in Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: '#2C2C2E',
            },
          ]}
          onPress={handleChooseAnother}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
            Try Another Place
          </Text>
        </TouchableOpacity>
      </View>
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
  content: {
    alignItems: 'center',
    marginBottom: 60,
    width: '100%',
    flexShrink: 0, // Prevent shrinking
  },
  photoContainer: {
    width: Dimensions.get('window').width - 40,
    height: 250,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  photoScrollView: {
    width: '100%',
    height: '100%',
  },
  photoScrollContent: {
    alignItems: 'center',
  },
  placePhoto: {
    width: Dimensions.get('window').width - 40,
    height: 250,
  },
  photoIndicatorContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
  placeholderPhoto: {
    width: Dimensions.get('window').width - 40,
    height: 250,
    borderRadius: 20,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  placeholderEmoji: {
    fontSize: 64,
  },
  arrivalText: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  placeInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  placeName: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeAddress: {
    fontSize: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

