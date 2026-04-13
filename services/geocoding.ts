import { Location } from '../types';
import { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN as ENV_TOKEN } from '@env';

const MAPBOX_ACCESS_TOKEN = ENV_TOKEN || '';

/**
 * Convert a city/zip code or address string to geographic coordinates
 * Uses Mapbox Geocoding API
 * 
 * @param query City name, zip code, or address string (e.g., "San Francisco, CA" or "90210")
 * @returns Location with latitude and longitude, or null if not found
 */
export async function geocodeLocation(query: string): Promise<Location | null> {
  if (!query.trim()) {
    throw new Error('Please enter a city, zip code, or address');
  }

  if (!MAPBOX_ACCESS_TOKEN) {
    throw new Error('Mapbox API key is not configured. Please set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env file.');
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Network request failed. Please check your internet connection.');
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [longitude, latitude] = feature.geometry.coordinates;

      return {
        latitude,
        longitude,
      };
    } else {
      throw new Error(`Location not found: "${query}". Try a different city name or zip code.`);
    }
  } catch (error: any) {
    // Re-throw custom errors
    if (error.message?.includes('Location not found') || 
        error.message?.includes('Mapbox API key') ||
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
