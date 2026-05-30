import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { ConfettiAnimation } from '../components/ConfettiAnimation';
import { ReviewPromptBanner } from '../components/ReviewPromptBanner';
import { addArrival, clearCacheEntry, getArrivalCount } from '../services/storage';
import { dismissReviewPrompt, requestAppReview, shouldShowReviewPrompt } from '../services/reviewPrompt';
import { FREE_LOCATIONS_LIMIT } from '../constants';
import { SORA } from '../constants/fonts';
import { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN as ENV_TOKEN } from '@env';

const EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = ENV_TOKEN || '';
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
  const { targetPlace, setSelectedCategory, setTargetPlace, refreshHistory, hasPurchased, setCategoryPreferences, selectedCategory, userLocation, categoryPreferences } = useAppContext();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [hasSavedArrival, setHasSavedArrival] = useState(false);
  const [mapImageReady, setMapImageReady] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const hasAnimatedRef = React.useRef(false);
  const reviewPromptCheckedRef = React.useRef(false);
  
  // Generate Mapbox static map URL with pin marker overlay
  // Format: /styles/v1/{style_id}/static/pin-s-{size}+{color}({lon},{lat})/{lon},{lat},{zoom}/{width}x{height}?access_token={token}
  // Example: pin-s-l+000(-87.0186,32.4055)/-87.0186,32.4055,14/500x300
  const screenWidth = Dimensions.get('window').width - 20; // Reduced margin for wider map
  const mapWidth = Math.round(screenWidth); // Use actual screen width (no @2x in URL)
  const mapHeight = 300;
  
  const lon = targetPlace?.location.longitude;
  const lat = targetPlace?.location.latitude;
  
  // Build URL - try without pin overlay first to test if basic map loads
  // If this works, we can add the pin back
  const mapImageUrl = targetPlace && EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN && lon !== undefined && lat !== undefined
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},15/${mapWidth}x${mapHeight}?access_token=${EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}`
    : null;
  
  
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

        if (!reviewPromptCheckedRef.current) {
          reviewPromptCheckedRef.current = true;
          const count = await getArrivalCount();
          if (await shouldShowReviewPrompt(count)) {
            setTimeout(() => setShowReviewPrompt(true), 2500);
          }
        }
        
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

  // Trigger animations when map image is ready
  useEffect(() => {
    if (!targetPlace) return;
    
    // Wait for map image to load, then animate
    const shouldAnimate = mapImageReady;
    
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
  }, [targetPlace, mapImageReady]);

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
    
    // Use business name only (no coordinates) for cleaner search
    let url: string;
    
    if (Platform.OS === 'ios') {
      // iOS: Try native Google Maps app directly (canOpenURL can be unreliable)
      url = `comgooglemaps://?q=${placeName}&center=${latitude},${longitude}&zoom=14`;
      
      try {
        await Linking.openURL(url);
        // If we get here, the app opened successfully
        return;
      } catch (err) {
        // App not installed, fall back to Apple Maps
        console.log('Google Maps app not available, using Apple Maps');
      }
      
      // Fallback to Apple Maps (iOS native)
      url = `http://maps.apple.com/?q=${placeName}&ll=${latitude},${longitude}`;
      try {
        await Linking.openURL(url);
        return;
      } catch (err) {
        console.error('Failed to open maps:', err);
      }
    } else {
      // Android: Try native Google Maps app with business name
      url = `google.navigation:q=${placeName}`;
      
      try {
        await Linking.openURL(url);
        return;
      } catch (err) {
        // Fall through to Android Maps (geo URL)
      }
      
      // Fallback to Android Maps (geo URL)
      url = `geo:0,0?q=${placeName}`;
      try {
        await Linking.openURL(url);
        return;
      } catch (err) {
        console.error('Failed to open maps:', err);
      }
    }
  };

  const handleChooseAnother = () => {
    setShowReviewPrompt(false);
    setSelectedCategory(null);
    setTargetPlace(null);
    setCategoryPreferences(null);
    router.replace('/');
  };

  const handleDismissReview = () => {
    setShowReviewPrompt(false);
    dismissReviewPrompt();
  };

  const handleRequestReview = () => {
    setShowReviewPrompt(false);
    requestAppReview();
  };

  if (!targetPlace) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <ConfettiAnimation trigger={confettiTrigger} />

      <View style={styles.content}>
        {/* Mapbox Map */}
        {mapImageUrl ? (
          <Animated.View style={[styles.mapContainer, photoAnimatedStyle]}>
            <Image
              source={{ uri: mapImageUrl }}
              style={styles.mapImage}
              resizeMode="cover"
              onLoadEnd={() => {
                console.log('✅ Map image loaded successfully');
                setMapImageReady(true);
              }}
              onError={(error) => {
                console.error('❌ Map image failed to load');
                console.error('Error details:', error.nativeEvent?.error || error);
                console.error('Map URL (token hidden):', mapImageUrl?.replace(EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN, 'TOKEN_HIDDEN'));
                
                // Try to fetch the URL directly to see the actual HTTP error
                if (mapImageUrl) {
                  fetch(mapImageUrl)
                    .then(response => {
                      console.error('HTTP Status:', response.status, response.statusText);
                      return response.text();
                    })
                    .then(text => {
                      console.error('Response body:', text.substring(0, 200));
                    })
                    .catch(fetchError => {
                      console.error('Fetch error:', fetchError);
                    });
                }
                
                setMapImageReady(true); // Still trigger animation even if image fails
              }}
            />
            
            {/* Pin Marker Overlay (visual enhancement) - only show if map loaded */}
            {mapImageReady && (
              <View style={[styles.pinMarker, { marginLeft: -12, marginTop: -24 }]}>
                <View style={styles.pinDot} />
                <View style={styles.pinShadow} />
              </View>
            )}
            
            {/* Map Attribution */}
            <View style={styles.mapAttribution}>
              <Text style={styles.mapAttributionText}>© Mapbox</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.placeholderMap, { backgroundColor: '#2C2C2E' }, photoAnimatedStyle]}>
            <Text style={[styles.placeholderEmoji, { color: '#8E8E93' }]}>
              🗺️
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

      <View style={styles.footer}>
        <ReviewPromptBanner
          visible={showReviewPrompt}
          onDismiss={handleDismissReview}
          onReview={handleRequestReview}
        />

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
  mapContainer: {
    width: Dimensions.get('window').width - 20, // Wider map with less margin
    height: 300,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    position: 'relative',
    backgroundColor: '#1C1C1E', // Fallback background color in case image doesn't load
  },
  mapImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1C1C1E', // Fallback in case image doesn't load
  },
  pinMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF0000',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  pinShadow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginTop: -2,
  },
  mapAttribution: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapAttributionText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: SORA.Medium,
  },
  placeholderMap: {
    width: Dimensions.get('window').width - 40,
    height: 300,
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
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 12,
    fontFamily: SORA.Regular,
    textAlign: 'center',
  },
  arrivalText: {
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: SORA.Bold,
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
    fontFamily: SORA.SemiBold,
    marginBottom: 8,
    textAlign: 'center',
  },
  placeAddress: {
    fontSize: 16,
    fontFamily: SORA.Regular,
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    gap: 12,
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
    fontFamily: SORA.SemiBold,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
  },
});

