import { Location, Place } from '../types';
import { CATEGORIES, Category, MIN_INITIAL_DISTANCE } from '../constants';
import { MAPBOX_ACCESS_TOKEN as ENV_TOKEN } from '@env';
import { getRecentPlaceIds } from './storage';

// Mapbox tokens work for both iOS and Android - no platform restrictions needed
// You can use a single token for both platforms
const MAPBOX_ACCESS_TOKEN = ENV_TOKEN || '';


const MAPBOX_SEARCH_API = 'https://api.mapbox.com/search/searchbox/v1/category';

// Map categories to Mapbox Search API category names
const MAPBOX_CATEGORY_NAMES: Record<Category, string> = {
  bars: 'bar',
  restaurants: 'restaurant',
  liquor_stores: 'liquor_store',
  cafes: 'cafe',
  random: 'attraction', // For random, we'll use a fallback or specific category
};

// For random category, use these specific categories
const RANDOM_CATEGORIES = [
  'museum',
  'park',
  'theater',
  'cinema',
  'stadium',
  'zoo',
  'aquarium',
  'art_gallery',
  'monument',
  'library',
];

// Map cuisine types to Mapbox search terms
const CUISINE_MAP: Record<string, string> = {
  italian: 'italian restaurant',
  chinese: 'chinese restaurant',
  mexican: 'mexican restaurant',
  japanese: 'japanese restaurant',
  indian: 'indian restaurant',
  thai: 'thai restaurant',
  american: 'american restaurant',
  french: 'french restaurant',
};

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param loc1 First location
 * @param loc2 Second location
 * @returns Distance in meters (converted to feet for display)
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
 * Get the place ID from a Mapbox Search API feature
 * The Search API uses properties.mapbox_id, not feature.id
 */
function getPlaceId(feature: any): string | undefined {
  return feature.properties?.mapbox_id || feature.id;
}

/**
 * Perform a search with Mapbox Search API category endpoint
 */
async function searchWithRadius(
  userLocation: Location,
  radius: number,
  category: Category,
  categoryInfo: any,
  categoryPreferences?: { restaurantCuisine?: string }
): Promise<any[]> {
  const placeIdMap = new Map<string, any>();
  
  try {
    console.log('🔍 searchWithRadius - category:', category, 'categoryPreferences:', categoryPreferences);
    let categoryName: string;
    
    if (category === 'random') {
      // For random, pick a random category from the list
      categoryName = RANDOM_CATEGORIES[Math.floor(Math.random() * RANDOM_CATEGORIES.length)];
      console.log('🔍 Random category selected:', categoryName);
    } else if (category === 'restaurants' && categoryPreferences?.restaurantCuisine) {
      // For cuisine-specific searches, use the cuisine in the category name
      categoryName = `${categoryPreferences.restaurantCuisine} restaurant`;
      console.log('🔍 Using cuisine-specific category:', categoryName);
    } else {
      categoryName = MAPBOX_CATEGORY_NAMES[category];
      console.log('🔍 Using mapped category name:', categoryName, 'for category:', category);
    }
    
    // Build Mapbox Search API category URL
    // Format: /category/{category}?proximity={lng},{lat}&limit={limit}&access_token={token}
    const proximity = `${userLocation.longitude},${userLocation.latitude}`;
    const limit = 20; // Limit results per request
    
    let url = `${MAPBOX_SEARCH_API}/${categoryName}?`;
    url += `proximity=${proximity}`;
    url += `&limit=${limit}`;
    url += `&access_token=${MAPBOX_ACCESS_TOKEN}`;

    // Note: The Search API category endpoint may not support bbox parameter
    // We'll filter by radius client-side after getting results
    
    // Keep logs useful but never print the token
    console.log('Mapbox Search API URL:', url.replace(MAPBOX_ACCESS_TOKEN, 'TOKEN_HIDDEN'));
    
    const response = await fetch(url);
    
    // Check if fetch failed
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapbox Search API error:', response.status, errorText);
      
      // Try to parse error as JSON to check for auth errors
      try {
        const errorData = JSON.parse(errorText);
        if (errorData?.message && typeof errorData.message === 'string') {
          const msg = errorData.message.toLowerCase();
          if (msg.includes('not authorized') || msg.includes('invalid token') || msg.includes('no token')) {
            throw new Error(`Mapbox auth error: ${errorData.message}`);
          }
        }
      } catch (e) {
        // Error text is not JSON, continue with generic error
      }
      
      // For 401/403, throw auth error; for 5xx, throw server error; otherwise network error
      if (response.status === 401 || response.status === 403) {
        throw new Error('Mapbox authentication failed. Please check your access token.');
      } else if (response.status >= 500) {
        throw new Error('Mapbox server error. Please try again later.');
      } else {
        throw new Error('Network request failed. Please check your internet connection.');
      }
    }
    
    const data = await response.json();
    // Double-check for auth errors in successful-looking responses (shouldn't happen, but just in case)
    if (data?.message && typeof data.message === 'string') {
      const msg = data.message.toLowerCase();
      if (msg.includes('not authorized') || msg.includes('invalid token') || msg.includes('no token')) {
        throw new Error(`Mapbox auth error: ${data.message}`);
      }
    }

    console.log('Mapbox Search API response type:', data.type || 'unknown');
    console.log('Mapbox Search API features count:', data.features?.length || 0);
    
    if (data.features && Array.isArray(data.features)) {
      console.log(`Mapbox Search API returned ${data.features.length} features`);
      
      data.features.forEach((feature: any) => {
        // Filter by radius first (Mapbox doesn't enforce radius, so we do it client-side)
        if (!feature.geometry?.coordinates) {
          console.log('Feature missing geometry.coordinates:', feature.properties?.name || 'unknown');
          return;
        }
        
        const [lng, lat] = feature.geometry.coordinates;
        const placeLocation: Location = { latitude: lat, longitude: lng };
        const distanceMeters = calculateDistance(userLocation, placeLocation);
        
        // Debug: log first few features to see what's happening
        const featureName = feature.properties?.name || 'unknown';
        
        // Filter by radius
        if (distanceMeters > radius) {
          if (placeIdMap.size < 3) {
            console.log(`  → Filtered out (distance ${distanceMeters.toFixed(0)}m > radius ${radius}m)`);
          }
          return;
        }
        
        // The Search API category endpoint returns POIs for the specified category
        // No need for additional category filtering - the API handles it
        
        // Use mapbox_id as unique identifier (Search API uses properties.mapbox_id, not feature.id)
        const placeId = feature.properties?.mapbox_id || feature.id;
        if (placeId) {
          placeIdMap.set(placeId, feature);
          if (placeIdMap.size <= 3) {
            console.log(`  → Added to results (ID: ${placeId})`);
          }
        } else {
          console.log(`  → Skipped (no ID found for ${featureName})`);
        }
      });
      
      console.log(`After filtering: ${placeIdMap.size} places`);
    } else {
      console.log('No features in Mapbox Search API response');
      console.log('Response data:', JSON.stringify(data, null, 2).substring(0, 1000));
      if (data.error) {
        console.error('Mapbox Search API error:', data.error);
      }
      if (data.message) {
        console.error('Mapbox Search API message:', data.message);
      }
    }
  } catch (error: any) {
    // Don't re-wrap auth errors or errors we've already properly formatted
    if (error.message?.includes('Mapbox auth') || error.message?.includes('authentication failed')) {
      throw error;
    }
    
    // Check if it's a network error (fetch failures, timeouts, etc.)
    if (error.message?.includes('Network') || error.message?.includes('fetch') || error.name === 'TypeError') {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    // Re-throw any other errors as-is
    throw error;
  }
  
  return Array.from(placeIdMap.values());
}

// Module-level guard to prevent concurrent calls to findNearestPlace
let isSearching = false;
let currentSearchKey: string | null = null;

/**
 * Find the nearest place of a given category using Mapbox Search API category endpoint
 * 
 * @param userLocation User's current location
 * @param category Category to search for
 * @param categoryPreferences Optional category preferences (cuisine)
 * @returns The nearest place or null if not found
 */
export async function findNearestPlace(
  userLocation: Location,
  category: Category,
  categoryPreferences?: { restaurantCuisine?: string }
): Promise<Place | null> {
  if (!MAPBOX_ACCESS_TOKEN) {
    throw new Error('Mapbox access token is not configured. Please set MAPBOX_ACCESS_TOKEN in your .env file.');
  }

  // Create a unique key for this search request (without distancePreferences to avoid duplicate issues)
  const searchKey = `${category}-${userLocation.latitude.toFixed(6)}-${userLocation.longitude.toFixed(6)}-${JSON.stringify(categoryPreferences)}`;
  
  // Prevent duplicate concurrent searches with the same parameters
  // Check and set atomically to prevent race conditions
  if (isSearching) {
    if (currentSearchKey === searchKey) {
      console.log('⚠️ Search already in progress for same parameters, skipping duplicate call');
      // Throw a special error that the hook can catch and ignore
      // Don't clear guard here - the primary call will handle it
      throw new Error('DUPLICATE_CALL_BLOCKED');
    } else {
      // Different search parameters - allow it but log
      console.log('⚠️ Different search in progress, but allowing this one');
    }
  }
  
  // Set guard synchronously (before any async operations) - this prevents race conditions
  // Track that THIS call set the guard so we only clear it in finally if we set it
  const thisCallSetGuard = !isSearching;
  isSearching = true;
  currentSearchKey = searchKey;

  const categoryInfo = CATEGORIES[category];

  try {
    console.log('=== Single Radius Search (Mapbox Search API) ===');
    console.log('User location:', userLocation);
    console.log('Category received:', category, 'Category label:', categoryInfo.label);
    
    // Single radius search - use 5km as default
    const searchRadius = 5000; // 5km default
    
    // Get recent place IDs early to check against
    const recentPlaceIds = await getRecentPlaceIds();
    console.log('Excluding recent place IDs:', recentPlaceIds);
    
    // Single search with the determined radius
    console.log(`Searching with radius: ${searchRadius}m`);
    const results = await searchWithRadius(userLocation, searchRadius, category, categoryInfo, categoryPreferences);
    
    console.log(`✅ searchWithRadius completed, found ${results.length} results`);
    
    // Filter out recent places and apply cuisine filter if needed
    const validResults = results
      .filter((place: any) => {
        // Exclude recent places
        const placeId = getPlaceId(place);
        if (placeId && recentPlaceIds.includes(placeId)) {
          return false;
        }
        
        // Calculate distance and check if too close
        if (!place.geometry?.coordinates) return false;
        const [lng, lat] = place.geometry.coordinates;
        const placeLocation: Location = { latitude: lat, longitude: lng };
        const distanceMeters = calculateDistance(userLocation, placeLocation);
        const distanceFeet = distanceMeters * 3.28084;
        if (distanceFeet < MIN_INITIAL_DISTANCE) {
          return false;
        }
        return true;
      });
    
    console.log(`✅ After filtering: ${validResults.length} valid places`);

    if (validResults.length > 0) {
      console.log('✅ Processing valid results...');
      // Calculate distance for all results and find the nearest one
      interface PlaceWithDistance {
        name: string;
        location: Location;
        address?: string;
        distance: number; // Required, always calculated in feet
        placeId?: string;
        rawPlace?: any;
      }
      
      // Calculate distances for all valid results
      const placesWithDistance: PlaceWithDistance[] = validResults
        .map((place: any): PlaceWithDistance | null => {
          if (!place.geometry?.coordinates) return null;
          const [lng, lat] = place.geometry.coordinates;
          const placeLocation: Location = {
            latitude: lat,
            longitude: lng,
          };
          const distanceMeters = calculateDistance(userLocation, placeLocation);
          const distanceFeet = distanceMeters * 3.28084; // Convert to feet for display
          return {
            name: place.properties?.name || place.text || 'Unknown',
            location: placeLocation,
            address: place.properties?.address || place.properties?.full_address || place.place_name,
            distance: distanceFeet, // Store in feet
            placeId: getPlaceId(place),
            rawPlace: place, // Keep original for debugging
          };
        })
        .filter((place): place is PlaceWithDistance => {
          if (!place) return false;
          // Filter out places that are too close (prevent immediate arrival trigger)
          if (place.distance < MIN_INITIAL_DISTANCE) {
            console.log(`Excluding place too close: ${place.name} - ${Math.round(place.distance)}ft (minimum: ${MIN_INITIAL_DISTANCE}ft)`);
            return false;
          }
          return true;
        });

      // If all results were filtered out, try one more larger radius search
      if (placesWithDistance.length === 0) {
        console.log('All results were filtered out. Trying one larger radius...');
        
        // Try one larger radius (20km) to find valid results
        const largerRadius = 20000; // 20km
        console.log(`Searching with larger radius: ${largerRadius}m`);
        const additionalResults = await searchWithRadius(userLocation, largerRadius, category, categoryInfo, categoryPreferences);
        
        // Process only NEW results (not already in allResultsMap)
        const newPlacesWithDistance: PlaceWithDistance[] = additionalResults
          .filter((place: any) => {
            const placeId = getPlaceId(place);
            // Skip duplicates (already handled in validResults filter)
            // No need to check allResultsMap since we're doing a single search
            // Skip if recent
            if (placeId && recentPlaceIds.includes(placeId)) {
              return false;
            }
            return true;
          })
          .map((place: any): PlaceWithDistance | null => {
            if (!place.geometry?.coordinates) return null;
            const [lng, lat] = place.geometry.coordinates;
            const placeLocation: Location = {
              latitude: lat,
              longitude: lng,
            };
            const distanceMeters = calculateDistance(userLocation, placeLocation);
            const distanceFeet = distanceMeters * 3.28084;
            const placeId = getPlaceId(place);
            return {
              name: place.properties?.name || place.text || 'Unknown',
              location: placeLocation,
              address: place.properties?.address || place.properties?.full_address || place.place_name,
              distance: distanceFeet,
              placeId: placeId,
              rawPlace: place,
            };
          })
          .filter((place): place is PlaceWithDistance => {
            if (!place) return false;
            // Filter out places that are too close (prevent immediate arrival trigger)
            if (place.distance < MIN_INITIAL_DISTANCE) {
              console.log(`Excluding place too close: ${place.name} - ${Math.round(place.distance)}ft (minimum: ${MIN_INITIAL_DISTANCE}ft)`);
              return false;
            }
            return true;
          });
        
        if (newPlacesWithDistance.length > 0) {
          placesWithDistance.push(...newPlacesWithDistance);
          console.log(`Found ${newPlacesWithDistance.length} valid places in ${largerRadius}m radius`);
        } else {
          console.log('No valid places found even after searching larger radius. Returning null.');
          return null;
        }
      }

      // Sort by distance to find the nearest
      placesWithDistance.sort((a: PlaceWithDistance, b: PlaceWithDistance) => a.distance - b.distance);

      console.log('\n=== All Places Found (sorted by distance) ===');
      placesWithDistance.forEach((p: PlaceWithDistance, index: number) => {
        const distanceMiles = p.distance / 5280;
        console.log(`${index + 1}. ${p.name}`);
        console.log(`   Distance: ${Math.round(p.distance)}ft (${distanceMiles.toFixed(2)}mi)`);
        console.log(`   Address: ${p.address || 'N/A'}`);
        console.log(`   Location: ${p.location.latitude}, ${p.location.longitude}`);
        console.log(`   Place ID: ${p.placeId || 'N/A'}`);
        console.log('');
      });

      // Get the nearest place (first after sorting)
      const nearestPlace = placesWithDistance[0];
      const nearestDistanceMiles = nearestPlace.distance / 5280;
      console.log('=== Selected Nearest Place ===');
      console.log('Name:', nearestPlace.name);
      console.log('Distance:', Math.round(nearestPlace.distance), 'ft (', nearestDistanceMiles.toFixed(2), 'mi)');

      // Mapbox doesn't provide photos directly like Google Places
      // You can use Mapbox Static Images API or skip photos
      // For now, we'll skip photos (you can add them later if needed)
      let photos: string[] = [];
      
      // Optional: Use Mapbox Static Images API for a map thumbnail
      // const staticImageUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ff0000(${nearestPlace.location.longitude},${nearestPlace.location.latitude})/${nearestPlace.location.longitude},${nearestPlace.location.latitude},14,0/400x300?access_token=${MAPBOX_ACCESS_TOKEN}`;
      // photos = [staticImageUrl];

      // Google Places Photo API code (commented out - for reference if switching back to Google)
      // if (nearestPlace.rawPlace?.photos && Array.isArray(nearestPlace.rawPlace.photos) && nearestPlace.rawPlace.photos.length > 0) {
      //   // Get only the first photo
      //   const photo = nearestPlace.rawPlace.photos[0];
      //   // Google Places Photo API URL
      //   // maxwidth=800 for good quality without being too large
      //   photos = [`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`];
      // }

      const nearestPlaceResult: Place = {
        name: nearestPlace.name,
        location: nearestPlace.location,
        address: nearestPlace.address,
        distance: nearestPlace.distance,
        placeId: nearestPlace.placeId,
        photos: photos.length > 0 ? photos : undefined,
      };

      // Store all places for caching (will be used by the hook)
      (nearestPlaceResult as any)._allPlaces = placesWithDistance.slice(0, 5).map((p: PlaceWithDistance): Place => ({
        name: p.name,
        location: p.location,
        address: p.address,
        distance: p.distance,
        placeId: p.placeId,
        photos: undefined, // Only cache photos for the nearest
      }));

      return nearestPlaceResult;
    } else {
      console.log('No results found');
    }

    return null;
  } catch (error: any) {
    console.error('Error fetching nearest place:', error);
    
    // Check if it's a network/offline error
    if (error?.message?.toLowerCase().includes('internet') || 
        error?.message?.toLowerCase().includes('network') ||
        error?.name === 'TypeError' ||
        error?.message?.includes('fetch')) {
      // Clear guard before throwing (only if this call set it)
      if (currentSearchKey === searchKey) {
        isSearching = false;
        currentSearchKey = null;
      }
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    // Clear guard before re-throwing (only if this call set it)
    if (currentSearchKey === searchKey) {
      isSearching = false;
      currentSearchKey = null;
    }
    // Re-throw the original error if it's not a network error
    throw error;
  } finally {
    // Only clear the guard if THIS call set it (check by matching search key)
    if (currentSearchKey === searchKey) {
      isSearching = false;
      currentSearchKey = null;
    }
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
