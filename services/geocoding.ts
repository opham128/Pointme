import { Location } from '../types';
import { Platform } from 'react-native';
import { 
  GOOGLE_PLACES_API_KEY as ENV_API_KEY,
  // @ts-ignore - Platform-specific keys may not be in .env during development
  GOOGLE_PLACES_API_KEY_IOS,
  // @ts-ignore - Platform-specific keys may not be in .env during development
  GOOGLE_PLACES_API_KEY_ANDROID,
} from '@env';

// Get API key based on platform (same pattern as googlePlaces.ts)
const getApiKey = (): string => {
  if (Platform.OS === 'ios' && GOOGLE_PLACES_API_KEY_IOS) {
    return GOOGLE_PLACES_API_KEY_IOS;
  }
  if (Platform.OS === 'android' && GOOGLE_PLACES_API_KEY_ANDROID) {
    return GOOGLE_PLACES_API_KEY_ANDROID;
  }
  return ENV_API_KEY || '';
};

const GOOGLE_PLACES_API_KEY = getApiKey();

/**
 * Convert a city/zip code or address string to geographic coordinates
 * Uses Google Geocoding API
 * 
 * @param query City name, zip code, or address string (e.g., "San Francisco, CA" or "90210")
 * @returns Location with latitude and longitude, or null if not found
 */
export async function geocodeLocation(query: string): Promise<Location | null> {
  if (!query.trim()) {
    throw new Error('Please enter a city, zip code, or address');
  }

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('Google Places API key is not configured. Please set GOOGLE_PLACES_API_KEY in your .env file.');
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Network request failed. Please check your internet connection.');
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;

      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } else if (data.status === 'ZERO_RESULTS') {
      throw new Error(`Location not found: "${query}". Try a different city name or zip code.`);
    } else if (data.status === 'REQUEST_DENIED') {
      throw new Error('Geocoding service is not available. Please check your API key.');
    } else {
      throw new Error(`Geocoding error: ${data.status}`);
    }
  } catch (error: any) {
    // Re-throw custom errors
    if (error.message?.includes('Location not found') || 
        error.message?.includes('Geocoding service') ||
        error.message?.includes('Please enter')) {
      throw error;
    }

    // Check for network errors
    if (error.message?.includes('Network') || error.message?.includes('fetch') || error.name === 'TypeError') {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    throw new Error(error.message || 'Failed to geocode location');
  }
}
