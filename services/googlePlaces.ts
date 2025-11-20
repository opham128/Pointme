import { Location, Place } from '../types';
import { CATEGORIES, Category } from '../constants';
import { GOOGLE_PLACES_API_KEY as ENV_API_KEY } from '@env';

// Get API key from environment variable
// The babel plugin (react-native-dotenv) loads it from .env file
// Make sure to set GOOGLE_PLACES_API_KEY in your .env file (no spaces around =)
const GOOGLE_PLACES_API_KEY = ENV_API_KEY || '';

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param loc1 First location
 * @param loc2 Second location
 * @returns Distance in meters
 */
export function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (loc1.latitude * Math.PI) / 180;
  const φ2 = (loc2.latitude * Math.PI) / 180;
  const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find the nearest place of a given category using Google Places API
 * Uses Nearby Search API with user's location as the center
 * 
 * @param userLocation User's current location
 * @param category Category to search for
 * @returns The nearest place or null if not found
 */
export async function findNearestPlace(
  userLocation: Location,
  category: Category
): Promise<Place | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('Google Places API key is not configured. Please set GOOGLE_PLACES_API_KEY in your .env file.');
  }

  const categoryInfo = CATEGORIES[category];
  const radius = 5000; // Search within 5km

  // Use Google Places Nearby Search API
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLocation.latitude},${userLocation.longitude}&radius=${radius}&type=${categoryInfo.googleType}&key=${GOOGLE_PLACES_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get the first result (nearest place)
      const place = data.results[0];
      
      const placeLocation: Location = {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      };

      const distance = calculateDistance(userLocation, placeLocation);

      return {
        name: place.name,
        location: placeLocation,
        address: place.vicinity || place.formatted_address,
        distance,
        placeId: place.place_id,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching nearest place:', error);
    throw error;
  }
}

/**
 * Calculate bearing from user location to target location
 * Uses the atan2 formula for accurate bearing calculation
 * 
 * @param from Starting location
 * @param to Target location
 * @returns Bearing in degrees (0-360, where 0 is North)
 */
export function calculateBearing(from: Location, to: Location): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180) / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360

  return bearing;
}

