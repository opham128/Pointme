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

    console.log('=== Google Places API Response ===');
    console.log('Status:', data.status);
    console.log('Total results:', data.results?.length || 0);
    console.log('User location:', userLocation);
    console.log('Category:', categoryInfo.label);
    console.log('Search radius:', radius, 'meters');

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Calculate distance for all results and find the nearest one
      interface PlaceWithDistance {
        name: string;
        location: Location;
        address?: string;
        distance: number; // Required, always calculated
        placeId?: string;
        rawPlace?: any;
      }
      
      const placesWithDistance: PlaceWithDistance[] = data.results.map((place: any) => {
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
          rawPlace: place, // Keep original for debugging
        };
      });

      // Sort by distance to find the nearest
      placesWithDistance.sort((a: PlaceWithDistance, b: PlaceWithDistance) => a.distance - b.distance);

      console.log('\n=== All Places Found (sorted by distance) ===');
      placesWithDistance.forEach((p: PlaceWithDistance, index: number) => {
        console.log(`${index + 1}. ${p.name}`);
        console.log(`   Distance: ${Math.round(p.distance)}m (${Math.round(p.distance * 3.28084)}ft)`);
        console.log(`   Address: ${p.address || 'N/A'}`);
        console.log(`   Location: ${p.location.latitude}, ${p.location.longitude}`);
        console.log(`   Place ID: ${p.placeId || 'N/A'}`);
        console.log('');
      });

      // Get the nearest place (first after sorting)
      const nearestPlace = placesWithDistance[0];
      console.log('=== Selected Nearest Place ===');
      console.log('Name:', nearestPlace.name);
      console.log('Distance:', Math.round(nearestPlace.distance), 'm');

      return {
        name: nearestPlace.name,
        location: nearestPlace.location,
        address: nearestPlace.address,
        distance: nearestPlace.distance,
        placeId: nearestPlace.placeId,
      };
    } else {
      console.log('No results found or API error:', data.status, data.error_message);
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

