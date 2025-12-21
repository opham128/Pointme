import React from 'react';
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
import { useRouter } from 'expo-router';
import { Category } from '../types';
import { CATEGORIES, FREE_LOCATIONS_LIMIT } from '../constants';
import { CategoryButton } from '../components/CategoryButton';
import { useAppContext } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { clearAllStorage } from '../services/storage';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setSelectedCategory, setUserLocation, arrivalCount, hasPurchased, refreshHistory } = useAppContext();
  const { location, loading, error, permissionGranted, requestPermission } = useLocation();

  // Update context when location is available
  React.useEffect(() => {
    if (location) {
      setUserLocation(location);
    }
  }, [location, setUserLocation]);

  const handleCategorySelect = (category: Category) => {
    if (!permissionGranted || !location) {
      // Request permission if not granted
      requestPermission();
      return;
    }

    // Check if user needs to purchase before allowing new location
    const needsPurchase = !hasPurchased && arrivalCount >= FREE_LOCATIONS_LIMIT;
    
    if (needsPurchase) {
      // Show paywall instead of allowing new location
      router.push('/paywall');
      return;
    }

    setSelectedCategory(category);
    router.push('/compass');
  };

  const handleInviteFriend = async () => {
    try {
      const result = await Share.share({
        message: 'Point yourself towards the nearest bar 🍺',
        title: 'Point Me - Find Nearby Places',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

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
        <View style={styles.headerLeft} />
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Point Me
        </Text>
        <TouchableOpacity
          style={[styles.historyButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
          onPress={() => router.push('/history')}
        >
          <Text style={[styles.historyButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            📍 {arrivalCount}
          </Text>
        </TouchableOpacity>
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

      <TouchableOpacity
        style={[styles.inviteButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
        onPress={handleInviteFriend}
      >
        <Text style={[styles.inviteButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          👥 Invite Friend
        </Text>
      </TouchableOpacity>

      {/* Debug: Clear storage button (for testing) */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.debugButton, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}
          onPress={async () => {
            await clearAllStorage();
            await refreshHistory();
            alert('Storage cleared! Arrival count reset.');
          }}
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
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  headerLeft: {
    width: 100, // Same width as history button to balance the layout
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  historyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  historyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
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
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9500',
    borderStyle: 'dashed',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

