import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Category } from '../types';
import { CATEGORIES, FREE_LOCATIONS_LIMIT } from '../constants';
import { CategoryButton } from '../components/CategoryButton';
import { useAppContext } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { clearAllStorage } from '../services/storage';

const ACCENT_COLOR = '#007AFF';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setSelectedCategory, setUserLocation, arrivalCount, hasPurchased, refreshHistory } = useAppContext();
  const { location, loading, error, permissionGranted, requestPermission } = useLocation();
  
  // Animation values
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(-20);
  const pinScale = useSharedValue(1);
  const inviteScale = useSharedValue(1);
  const inviteEmoji = useSharedValue(1);

  // Header animation on load
  useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 600 });
    titleTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
  }, []);

  // Pulse animation for pin counter when arrivalCount changes
  useEffect(() => {
    if (arrivalCount > 0) {
      pinScale.value = withSequence(
        withSpring(1.15, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [arrivalCount]);

  // Update context when location is available
  React.useEffect(() => {
    if (location) {
      setUserLocation(location);
    }
  }, [location, setUserLocation]);

  const handleCategorySelect = (category: Category) => {
    if (!permissionGranted || !location) {
      requestPermission();
      return;
    }

    const needsPurchase = !hasPurchased && arrivalCount >= FREE_LOCATIONS_LIMIT;
    
    if (needsPurchase) {
      router.push('/paywall');
      return;
    }

    setSelectedCategory(category);
    router.push('/compass');
  };

  const handleInviteFriend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animation
    inviteScale.value = withSequence(
      withSpring(0.95, { damping: 15 }),
      withSpring(1, { damping: 15 })
    );
    inviteEmoji.value = withSequence(
      withSpring(1.2, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );

    try {
      const result = await Share.share({
        message: 'Point yourself towards the nearest bar 🍺',
        title: 'Point Me - Find Nearby Places',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleClearStorage = async () => {
    if (__DEV__) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await clearAllStorage();
      await refreshHistory();
      alert('Storage cleared! Arrival count reset.');
    }
  };

  // Animated styles
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const pinAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinScale.value }],
  }));

  const inviteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inviteScale.value }],
  }));

  const inviteEmojiAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inviteEmoji.value }],
  }));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#000000'} />
        <Text style={[styles.loadingText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Getting your location...
        </Text>
      </View>
    );
  }

  if (error || !permissionGranted) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
        <Text style={[styles.errorTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Location Permission Required
        </Text>
        <Text style={[styles.errorText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
          {error?.message || 'We need your location to find nearby places.'}
        </Text>
        <CategoryButton
          category="restaurants"
          onPress={async () => {
            await requestPermission();
          }}
        />
        <Text style={[styles.retryText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
          Tap above to grant permission
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>

      <View style={styles.header}>
        {hasPurchased && (
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}
            onPress={() => router.push('/settings')}
          >
            <Text style={[styles.settingsButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              ⚙️
            </Text>
          </TouchableOpacity>
        )}
        {!hasPurchased && <View style={styles.headerLeft} />}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.titleContainer}
        >
          <Animated.Text 
            style={[
              styles.title, 
              { color: isDark ? '#FFFFFF' : '#000000' },
              titleAnimatedStyle
            ]}
          >
            Point Me
          </Animated.Text>
        </TouchableOpacity>
        <Animated.View style={pinAnimatedStyle}>
          <TouchableOpacity
            style={[
              styles.historyButton,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA',
                borderColor: ACCENT_COLOR,
              },
            ]}
            onPress={() => router.push('/history')}
          >
            <Text style={[styles.historyButtonText, { color: ACCENT_COLOR }]}>
              📍 {arrivalCount}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Text style={[styles.subtitle, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
        Choose a destination type
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {(Object.keys(CATEGORIES) as Category[]).map((category) => (
          <CategoryButton
            key={category}
            category={category}
            onPress={handleCategorySelect}
          />
        ))}
      </ScrollView>

      <Animated.View style={inviteAnimatedStyle}>
        <TouchableOpacity
          style={[
            styles.inviteButton,
            {
              backgroundColor: isDark ? 'transparent' : 'transparent',
              borderColor: ACCENT_COLOR,
            },
          ]}
          onPress={handleInviteFriend}
        >
          <Animated.Text style={inviteEmojiAnimatedStyle}>
            <Text style={styles.inviteEmoji}>👥</Text>
          </Animated.Text>
          <Text style={[styles.inviteButtonText, { color: ACCENT_COLOR }]}>
            Invite Friend
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {__DEV__ && (
        <TouchableOpacity
          style={[
            styles.debugButton,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
              borderColor: '#FF9500',
            },
          ]}
          onPress={handleClearStorage}
        >
          <Text style={[styles.debugButtonText, { color: '#FF9500' }]}>
            🧪 Clear Storage (Debug)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 70,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  headerLeft: {
    width: 100,
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  settingsButtonText: {
    fontSize: 20,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 80,
  },
  historyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    paddingTop: 30,
    marginBottom: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
  retryText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  inviteButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 20,
    marginHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  inviteEmoji: {
    fontSize: 20,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
