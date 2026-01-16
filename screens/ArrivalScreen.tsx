import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
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
import { addArrival } from '../services/storage';
import { FREE_LOCATIONS_LIMIT } from '../constants';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default function ArrivalScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { targetPlace, setSelectedCategory, setTargetPlace, refreshHistory, arrivalCount, hasPurchased } = useAppContext();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [hasSavedArrival, setHasSavedArrival] = useState(false);
  
  // Animation values
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Save arrival to history (allow 5th arrival, paywall shows when selecting new category)
    if (targetPlace && !hasSavedArrival) {
      addArrival(targetPlace).then(() => {
        refreshHistory();
        setHasSavedArrival(true);
      });
    }

    // Haptic feedback for arrival (success notification)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Trigger confetti
    setConfettiTrigger((prev) => prev + 1);

    // Animate arrival message
    scale.value = withSequence(
      withSpring(1.2, { damping: 8 }),
      withSpring(1, { damping: 10 })
    );
    opacity.value = withTiming(1, { duration: 500 });
  }, [targetPlace, hasSavedArrival, refreshHistory]);

  // Redirect if no target place
  useEffect(() => {
    if (!targetPlace) {
      router.replace('/');
    }
  }, [targetPlace, router]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

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
    router.replace('/');
  };

  if (!targetPlace) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <ConfettiAnimation trigger={confettiTrigger} />

      <Animated.View style={[styles.content, animatedStyle]}>
        {/* Photo Gallery */}
        {targetPlace.photos && targetPlace.photos.length > 0 ? (
          <View style={styles.photoContainer}>
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
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)' },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.placeholderPhoto, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
            <Text style={[styles.placeholderEmoji, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
              📍
            </Text>
          </View>
        )}
        
        <Text style={[styles.arrivalText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          You've Arrived!
        </Text>

        <View style={styles.placeInfo}>
          <Text style={[styles.placeName, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            {targetPlace.name}
          </Text>
          {targetPlace.address && (
            <Text style={[styles.placeAddress, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
              {targetPlace.address}
            </Text>
          )}
        </View>
      </Animated.View>

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
              backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
            },
          ]}
          onPress={handleChooseAnother}
        >
          <Text style={[styles.buttonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            Choose Another Destination
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

