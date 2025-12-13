import { Location, Place } from '../types';
import { CATEGORIES, Category } from '../constants';
import { GOOGLE_PLACES_API_KEY as ENV_API_KEY } from '@env';
import { getRecentPlaceIds } from './storage';

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
 * Perform a search with a specific radius and return results
 * Helper function to avoid code duplication
 */
async function searchWithRadius(
  userLocation: Location,
  radius: number,
  category: Category,
  categoryInfo: any
): Promise<any[]> {
  const placeIdMap = new Map<string, any>();
  
  if (category === 'random') {
    const randomQueries = [
      'attractions',
      'things to do',
      'fun activities',
      'tourist attractions',
      'points of interest'
    ];
    const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(randomQuery)}&location=${userLocation.latitude},${userLocation.longitude}&radius=${radius}&key=${GOOGLE_PLACES_API_KEY}`;
    const textResponse = await fetch(textSearchUrl);
    const textData = await textResponse.json();
    
    if (textData.status === 'OK' && textData.results) {
      textData.results.forEach((place: any) => {
        if (place.place_id) {
          placeIdMap.set(place.place_id, place);
        }
      });
    }
  } else {
    // Use Nearby Search for all categories (including bars)
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLocation.latitude},${userLocation.longitude}&radius=${radius}&type=${categoryInfo.googleType}&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results) {
      data.results.forEach((place: any) => {
        if (place.place_id) {
          placeIdMap.set(place.place_id, place);
        }
      });
    }
  }
  
  return Array.from(placeIdMap.values());
}

/**
 * Find the nearest place of a given category using Google Places API
 * Uses progressive radius searches to ensure we find the closest places
 * even when Google's API doesn't return all results in a single query
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
  
  // Progressive radius search: start small to catch nearby places, then expand
  // This ensures we find places within 200m that might be missed in a single large-radius search
  const searchRadii = [1000, 5000, 10000]; // 500m, 1km, 2km, 5km, 10km

  try {
    console.log('=== Progressive Radius Search ===');
    console.log('User location:', userLocation);
    console.log('Category:', categoryInfo.label);
    
    // Search with progressively larger radii, stopping when we find results
    // Since we sort by distance, results from a smaller radius will be closest
    const allResultsMap = new Map<string, any>();
    
    for (const radius of searchRadii) {
      console.log(`Searching with radius: ${radius}m`);
      const results = await searchWithRadius(userLocation, radius, category, categoryInfo);
      
      let newResults = 0;
      results.forEach((place: any) => {
        if (place.place_id && !allResultsMap.has(place.place_id)) {
          allResultsMap.set(place.place_id, place);
          newResults++;
        }
      });
      
      console.log(`  Found ${results.length} results (${newResults} new)`);
      
      // If we found results in this radius, break - we don't need to search larger radii
      // since we'll sort by distance and the closest will be from this smaller radius
      if (results.length > 0) {
        console.log(`  Found results in ${radius}m radius, stopping search`);
        break;
      }
    }
    
    const allResults = Array.from(allResultsMap.values());
    console.log(`Total unique places found: ${allResults.length}`);
    
    const data = { status: allResults.length > 0 ? 'OK' : 'ZERO_RESULTS', results: allResults };

    console.log('=== Google Places API Response ===');
    console.log('Status:', data.status);
    console.log('Total results:', data.results?.length || 0);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get recent place IDs to exclude from results
      const recentPlaceIds = await getRecentPlaceIds();
      console.log('Excluding recent place IDs:', recentPlaceIds);

      // Calculate distance for all results and find the nearest one
      interface PlaceWithDistance {
        name: string;
        location: Location;
        address?: string;
        distance: number; // Required, always calculated
        placeId?: string;
        rawPlace?: any;
      }
      
      // Filter out recent places and calculate distances
      const placesWithDistance: PlaceWithDistance[] = data.results
        .filter((place: any) => {
          // Exclude places that are in recent history
          if (place.place_id && recentPlaceIds.includes(place.place_id)) {
            console.log(`Excluding recent place: ${place.name} (${place.place_id})`);
            return false;
          }
          return true;
        })
        .map((place: any) => {
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

      // Check if all results were filtered out
      if (placesWithDistance.length === 0) {
        console.log('All results were filtered out (recent places). Returning null.');
        return null;
      }

      // Sort by distance to find the nearest
      placesWithDistance.sort((a: PlaceWithDistance, b: PlaceWithDistance) => a.distance - b.distance);

      console.log('\n=== All Places Found (sorted by distance) ===');
      placesWithDistance.forEach((p: PlaceWithDistance, index: number) => {
        console.log(`${index + 1}. ${p.name}`);
        console.log(`   Distance: ${Math.round(p.distance)}m`);
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
      console.log('No results found or API error:', data.status);
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

