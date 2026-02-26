import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { togglePurchaseStatusDebug } from '../services/purchases';
import { RESTAURANT_CUISINES } from '../constants';
import { SORA } from '../constants/fonts';

const ACCENT_COLOR = '#007AFF';

export default function HomeScreen() {
  const isDark = true; // Always dark mode
  const router = useRouter();
  const { setSelectedCategory, requestSearch, setUserLocation, arrivalCount, hasPurchased, refreshHistory, refreshPurchaseStatus, setCategoryPreferences, userLocation: contextLocation } = useAppContext();
  const { location, loading, error, permissionGranted, requestPermission } = useLocation();
  
  // Use location from context immediately if available (prevents long loading when navigating back)
  const effectiveLocation = location || contextLocation;
  
  // Category filtering state (for paid users) - reset each time, not saved
  const [restaurantCuisine, setRestaurantCuisine] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);

  
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
    if (!permissionGranted || !effectiveLocation) {
      requestPermission();
      return;
    }

    const needsPurchase = !hasPurchased && arrivalCount >= FREE_LOCATIONS_LIMIT;
    
    if (needsPurchase) {
      router.push('/paywall');
      return;
    }

    // Set category preferences for this search (only if paid user and selections made)
    if (hasPurchased) {
      const prefs: { restaurantCuisine?: string } = {};
      if (category === 'restaurants' && restaurantCuisine !== null) {
        prefs.restaurantCuisine = restaurantCuisine;
      }
      setCategoryPreferences(Object.keys(prefs).length > 0 ? prefs : null);
    } else {
      setCategoryPreferences(null);
    }

    setExpandedCategory(null); // Collapse after selection
    requestSearch(); // So useNearestPlace only runs a query when user tapped category/Search here
    setSelectedCategory(category);
    router.push('/compass');
  };

  const handleCategoryPress = (category: Category) => {
    if (!hasPurchased) {
      // For non-paid users, just select the category
      handleCategorySelect(category);
      return;
    }

    // Only restaurants have filters - others go directly
    if (category !== 'restaurants') {
      handleCategorySelect(category);
      return;
    }

    // For restaurants, toggle expansion
    if (expandedCategory === category) {
      // If already expanded, just collapse (don't search)
      setExpandedCategory(null);
    } else {
      // Expand to show filter options
      setExpandedCategory(category);
    }
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

  const handleTogglePurchase = async () => {
    if (__DEV__) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const newStatus = await togglePurchaseStatusDebug();
        await refreshPurchaseStatus();
        alert(`Purchase status: ${newStatus ? 'PAID USER' : 'FREE USER'}`);
      } catch (error) {
        alert('Error toggling purchase status');
      }
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

  // Only show loading if we don't have location from context either
  if (loading && !contextLocation) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>
          Getting your location...
        </Text>
      </View>
    );
  }

  if (error || !permissionGranted) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <Text style={[styles.errorTitle, { color: '#FFFFFF' }]}>
          Location Permission Required
        </Text>
        <Text style={[styles.errorText, { color: '#8E8E93' }]}>
          {error?.message || 'We need your location to find nearby places.'}
        </Text>
        <CategoryButton
          category="restaurants"
          onPress={async () => {
            await requestPermission();
          }}
        />
        <Text style={[styles.retryText, { color: '#8E8E93' }]}>
          Tap above to grant permission
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>

      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <TouchableOpacity
          activeOpacity={1}
          style={styles.titleContainer}
        >
          <Animated.Text 
            style={[
              styles.title, 
              { color: '#FFFFFF' },
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
                backgroundColor: '#1C1C1E',
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

      <Text style={[styles.subtitle, { color: '#8E8E93' }]}>
        Choose a destination type
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {(Object.keys(CATEGORIES) as Category[]).map((category) => (
          <View key={category} style={styles.categoryRow}>
            <CategoryButton
              category={category}
              onPress={hasPurchased ? () => handleCategoryPress(category) : handleCategorySelect}
            />
            
            {/* Expandable filter options (Paid Users Only) */}
            {hasPurchased && expandedCategory === category && (
              <View style={[styles.expandedFilterContainer, { backgroundColor: '#1C1C1E' }]}>
                {category === 'restaurants' && (
                  <>
                    <Text style={[styles.categoryFilterLabel, { color: '#FFFFFF' }]}>
                      🍽️ Restaurant Type
                    </Text>
                    <View style={styles.cuisineButtonsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.cuisineButton,
                          {
                            backgroundColor: restaurantCuisine === null ? '#007AFF' : '#2C2C2E',
                            borderColor: restaurantCuisine === null ? '#007AFF' : '#3A3A3C',
                          },
                        ]}
                        onPress={() => setRestaurantCuisine(null)}
                      >
                        <Text style={[styles.cuisineButtonText, { color: restaurantCuisine === null ? '#FFFFFF' : '#8E8E93' }]}>
                          All
                        </Text>
                      </TouchableOpacity>
                      {RESTAURANT_CUISINES.map((cuisine) => (
                        <TouchableOpacity
                          key={cuisine.value}
                          style={[
                            styles.cuisineButton,
                            {
                              backgroundColor: restaurantCuisine === cuisine.value ? '#007AFF' : '#2C2C2E',
                              borderColor: restaurantCuisine === cuisine.value ? '#007AFF' : '#3A3A3C',
                            },
                          ]}
                          onPress={() => setRestaurantCuisine(cuisine.value)}
                        >
                          <Text style={[styles.cuisineButtonText, { color: restaurantCuisine === cuisine.value ? '#FFFFFF' : '#8E8E93' }]}>
                            {cuisine.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.searchButton, { backgroundColor: '#007AFF' }]}
                      onPress={() => handleCategorySelect('restaurants')}
                    >
                      <Text style={styles.searchButtonText}>Search</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Animated.View style={[inviteAnimatedStyle, styles.inviteFooter]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.inviteButton}
          onPress={handleInviteFriend}
        >
          <Animated.Text style={inviteEmojiAnimatedStyle}>
            <Text style={styles.inviteEmoji}>👤</Text>
          </Animated.Text>
          <Text style={styles.inviteButtonTitle}>Invite a friend</Text>
        </TouchableOpacity>
      </Animated.View>
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
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    fontFamily: SORA.Bold,
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
    fontFamily: SORA.Bold,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: SORA.Regular,
    textAlign: 'center',
    paddingTop: 30,
    marginBottom: 30,
  },
  expandedFilterContainer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  categoryFilterContainer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  categoryFilterLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
    marginBottom: 12,
  },
  cuisineButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cuisineButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
  },
  cuisineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
  },
  priceButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 70,
    alignItems: 'center',
  },
  priceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  categoryRow: {
    marginBottom: 4,
  },
  inviteFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: SORA.Regular,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: SORA.Bold,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    fontFamily: SORA.Regular,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  retryText: {
    fontSize: 14,
    fontFamily: SORA.Regular,
    textAlign: 'center',
    marginTop: 12,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.35)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    minHeight: 52,
  },
  inviteEmoji: {
    fontSize: 20,
  },
  inviteButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
    color: '#FFFFFF',
  },
  debugContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  debugButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
