import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { ConfettiAnimation } from '../components/ConfettiAnimation';
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
  const { targetPlace, setSelectedCategory, setTargetPlace } = useAppContext();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  
  // Animation values
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Trigger confetti
    setConfettiTrigger((prev) => prev + 1);

    // Animate arrival message
    scale.value = withSequence(
      withSpring(1.2, { damping: 8 }),
      withSpring(1, { damping: 10 })
    );
    opacity.value = withTiming(1, { duration: 500 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handleOpenInMaps = () => {
    if (!targetPlace) return;

    const { latitude, longitude } = targetPlace.location;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
    });

    if (url) {
      Linking.openURL(url).catch((err) => {
        console.error('Failed to open maps:', err);
        // Fallback to web maps
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        Linking.openURL(webUrl);
      });
    }
  };

  const handleChooseAnother = () => {
    setSelectedCategory(null);
    setTargetPlace(null);
    router.replace('/');
  };

  if (!targetPlace) {
    router.replace('/');
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <ConfettiAnimation trigger={confettiTrigger} />

      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={[styles.emoji, { color: isDark ? '#FFFFFF' : '#000000' }]}>🎉</Text>
        
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
  emoji: {
    fontSize: 80,
    marginBottom: 20,
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

