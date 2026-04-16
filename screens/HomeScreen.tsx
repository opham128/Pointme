import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
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
import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { Category, Location } from '../types';
import { CATEGORIES, FREE_LOCATIONS_LIMIT } from '../constants';
import { CategoryButton } from '../components/CategoryButton';
import { useAppContext } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { clearAllStorage } from '../services/storage';
import { togglePurchaseStatusDebug } from '../services/purchases';
import { RESTAURANT_CUISINES } from '../constants';
import { SORA } from '../constants/fonts';
import { geocodeLocation } from '../services/geocoding';
import { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN } from '@env';

const ACCENT_COLOR = '#007AFF';
const BORDER = '#242424';
const WHITE  = '#F0EDE6'; 

export default function HomeScreen() {
  const isDark = true; // Always dark mode
  const router = useRouter();
  const { setSelectedCategory, requestSearch, setUserLocation, arrivalCount, hasPurchased, refreshHistory, refreshPurchaseStatus, setCategoryPreferences, userLocation: contextLocation, manualLocation, setManualLocation } = useAppContext();
  const { location, loading, error, permissionGranted, requestPermission } = useLocation();
  
  // Use location from context immediately if available (prevents long loading when navigating back)
  // Fall back to manual location if GPS is not available
  const effectiveLocation = location || contextLocation || manualLocation;
  
  // Category filtering state (for paid users) - reset each time, not saved
  const [restaurantCuisine, setRestaurantCuisine] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);

  // Manual location search state (when GPS permission denied)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [showLocationSearch, setShowLocationSearch] = useState<boolean>(false);
  const [autocompleteResults, setAutocompleteResults] = useState<any[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
  
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
    // Only require permission if there's NO location source at all
    // If user has manual location set, they don't need GPS permission
    if (!effectiveLocation) {
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

  // Handle "Locate Me" button press - only request permission when user explicitly presses button
  const handleLocateMe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Check current permission status first
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();
    
    if (status === 'denied') {
      // Permission was already denied (possibly with "Never Allow")
      // Try requesting again - if it's "Never Allow", dialog won't show
      const result = await ExpoLocation.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') {
        // Still denied - show alert to open Settings
        Alert.alert(
          'Location Permission Required',
          'To use GPS, please enable location access in Settings. Tap "Open Settings" below.',
          [
            { text: 'Cancel', onPress: () => {}, style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings(), style: 'default' }
          ]
        );
        return;
      }
    } else {
      // First time or not yet decided - request normally
      await requestPermission();
    }
  };

  // Handle autocomplete search
  const handleLocationAutocomplete = async (text: string) => {
    setSearchQuery(text);
    setSearchError('');

    if (!text.trim() || text.length < 2) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?limit=5&access_token=${EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}`
      );
      const data = await response.json();

      if (data.features) {
        setAutocompleteResults(
          data.features.map((feature: any) => ({
            id: feature.id,
            placeName: feature.place_name,
            coordinates: feature.geometry.coordinates,
          }))
        );
        setShowAutocomplete(true);
      }
    } catch (err) {
      console.log('Autocomplete error:', err);
      setAutocompleteResults([]);
    }
  };

  // Handle selecting an autocomplete result
  const handleSelectResult = async (result: any) => {
    const [lng, lat] = result.coordinates;
    const location: Location = {
      latitude: lat,
      longitude: lng,
    };
    
    setManualLocation(location);
    setShowLocationSearch(false);
    setSearchQuery('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Show success feedback
    Alert.alert('Location Set', `${result.placeName}\nYou can now search for places!`);
  };

  // Handle manual location search (fallback if user doesn't select autocomplete)
  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a city, zip code, or address');
      return;
    }

    setSearchLoading(true);
    setSearchError('');

    try {
      const result = await geocodeLocation(searchQuery);
      setManualLocation(result);
      setShowLocationSearch(false);
      setSearchQuery('');
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Show success feedback
      Alert.alert('Location Set', `${searchQuery}\nYou can now search for places!`);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to find location');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } finally {
      setSearchLoading(false);
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
        title: 'Point Me: Random Bar Compass',
        url: 'https://apps.apple.com/us/app/pointme-random-bar-compass/id6761635879',
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
      Alert.alert('Storage Cleared', 'Arrival count reset.');
    }
  };

  const handleTogglePurchase = async () => {
    if (__DEV__) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const newStatus = await togglePurchaseStatusDebug();
        await refreshPurchaseStatus();
        Alert.alert('Purchase Status', newStatus ? 'PAID USER' : 'FREE USER');
      } catch (error) {
        Alert.alert('Error', 'Error toggling purchase status');
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

  const inviteAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: inviteScale.value }] }));

  const inviteEmojiAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inviteEmoji.value }],
  }));

  // Only show loading if we don't have location from context either
  if (loading && !contextLocation && !manualLocation) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>
          Getting your location...
        </Text>
      </View>
    );
  }

  // Show location setup page ONLY if:
  // 1. Permission is NOT granted
  // 2. AND location is not available from other sources
  if (!permissionGranted && !location && !manualLocation) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#000000' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: '#000000' }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingTop: 60, marginBottom: 30 }}>
            <Text style={[styles.errorTitle, { color: '#FFFFFF' }]}>
              📍 Set Your Location
            </Text>
            <Text style={[styles.errorText, { color: '#8E8E93', marginTop: 12 }]}>
              Choose how to search for places
            </Text>
          </View>

          {/* GPS Location (Top/Preferred) */}
          <View style={[styles.locationOptionContainer, { marginBottom: 30 }]}>
            <Text style={[styles.locationSearchLabel, { color: '#FFFFFF', marginBottom: 12 }]}>
              📡 Use GPS (Recommended)
            </Text>
            <Text style={[styles.locationSearchDescription, { color: '#8E8E93' }]}>
              Enable real-time location for precise navigation to nearby places
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: '#30B0C0', marginTop: 12 }]}
              onPress={handleLocateMe}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>Locate Me</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: '#3A3A3C' }]} />

          {/* Manual Location Search */}
          <View style={[styles.locationSearchContainer, { backgroundColor: '#1C1C1E', marginTop: 30, marginBottom: 300 }]}>
            <Text style={[styles.locationSearchLabel, { color: '#FFFFFF' }]}>
              🔍 Search by City or Zip Code
            </Text>
            <Text style={[styles.locationSearchDescription, { color: '#8E8E93', marginBottom: 12 }]}>
              Search for places without GPS
            </Text>
            <View style={{ position: 'relative', zIndex: 1000 }}>
              <TextInput
                style={[styles.locationSearchInput, { color: '#FFFFFF', borderColor: searchError ? '#FF3B30' : '#3A3A3C' }]}
                placeholder="e.g., San Francisco, 90210"
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={handleLocationAutocomplete}
                editable={!searchLoading}
              />
              
              {/* Autocomplete Dropdown */}
              {showAutocomplete && autocompleteResults.length > 0 && (
                <View style={[styles.autocompleteDropdown, { backgroundColor: '#2C2C2E' }]}>
                  <FlatList
                    data={autocompleteResults}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.autocompleteItem}
                        onPress={() => handleSelectResult(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.autocompleteItemText, { color: '#FFFFFF' }]}>
                          {item.placeName}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
            </View>

            {searchError ? (
              <Text style={[styles.errorMessage, { color: '#FF3B30' }]}>{searchError}</Text>
            ) : null}
            {!showAutocomplete && searchQuery.trim() && (
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: '#007AFF', marginTop: 12 }]}
                onPress={handleLocationSearch}
                disabled={searchLoading}
                activeOpacity={0.8}
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.permissionButtonText}>Find Location</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Info Text */}
          <Text style={[styles.infoText, { color: '#8E8E93', marginTop: 40 }]}>
            GPS is recommended for the best compass navigation experience. Manual location search works for initial searches.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Show error if there's a location error (for actual technical issues)
  if (error && !manualLocation) {
    const openAppSettings = () => Linking.openSettings();

    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <Text style={[styles.errorTitle, { color: '#FFFFFF' }]}>
          Location Error
        </Text>
        <Text style={[styles.errorText, { color: '#8E8E93' }]}>
          {error?.message || 'Failed to access location.'}
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: '#007AFF' }]}
          onPress={handleLocateMe}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, styles.permissionButtonSecondary]}
          onPress={openAppSettings}
          activeOpacity={0.8}
        >
          <Text style={[styles.permissionButtonTextSecondary, { color: '#8E8E93' }]}>
            Open Settings
          </Text>
        </TouchableOpacity>
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

      <Animated.View style={[styles.inviteFooter, inviteAnimStyle]}>
        <TouchableOpacity style={styles.inviteButton} onPress={handleInviteFriend} activeOpacity={0.85}>
          <Text style={styles.inviteText}>👥  Drag a friend along</Text>
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
    paddingHorizontal: 20,
  },
  permissionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 200,
  },
  permissionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3A3A3C',
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
    color: '#FFFFFF',
  },
  permissionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
  },
  inviteFooter: {
    paddingBottom: 34,
    paddingTop: 12,
  },
  inviteButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  inviteText: {
    color: WHITE,
    fontFamily: SORA.SemiBold,
    fontSize: 15,
    letterSpacing: 0.5,
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
  
  // Location search styles
  locationSearchContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  locationSearchLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
    marginBottom: 12,
  },
  locationSearchDescription: {
    fontSize: 14,
    fontFamily: SORA.Regular,
    lineHeight: 21,
  },
  locationSearchInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    fontSize: 16,
    fontFamily: SORA.Regular,
  },
  errorMessage: {
    fontSize: 13,
    fontFamily: SORA.Regular,
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  locationOptionContainer: {
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    fontFamily: SORA.Regular,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  
  // Autocomplete styles
  autocompleteDropdown: {
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    overflow: 'hidden',
  },
  autocompleteItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  autocompleteItemText: {
    fontSize: 14,
    fontFamily: SORA.Regular,
  },
});
