import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Category } from '../types';
import { CATEGORIES } from '../constants';
import { CategoryButton } from '../components/CategoryButton';
import { useAppContext } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setSelectedCategory, setUserLocation } = useAppContext();
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

    setSelectedCategory(category);
    router.push('/compass');
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
      <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>
        Point Me
      </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
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
});

