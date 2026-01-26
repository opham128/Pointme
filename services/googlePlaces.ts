import { Location, Place } from '../types';
import { CATEGORIES, Category, MIN_INITIAL_DISTANCE } from '../constants';
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
 * Perform a search with a specific radius and return results
 * Helper function to avoid code duplication
 */
async function searchWithRadius(
  userLocation: Location,
  radius: number,
  category: Category,
  categoryInfo: any,
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
): Promise<any[]> {
  const placeIdMap = new Map<string, any>();
  
  try {
    let response: Response;
    
    if (category === 'random') {
      const randomQueries = [
        'attractions',
        'things to do',
        'fun activities',
        'tourist attractions',
        'Things to see near me'
      ];
      const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];
      const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(randomQuery)}&location=${userLocation.latitude},${userLocation.longitude}&radius=${radius}&key=${GOOGLE_PLACES_API_KEY}`;
      response = await fetch(textSearchUrl);
    } else if (category === 'restaurants' && categoryPreferences?.restaurantCuisine) {
      // Use Text Search for specific cuisine type
      const cuisineType = categoryPreferences.restaurantCuisine;
      const query = `${cuisineType} restaurant`;
      const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${userLocation.latitude},${userLocation.longitude}&radius=${radius}&key=${GOOGLE_PLACES_API_KEY}`;
      response = await fetch(textSearchUrl);
    } else {
      // Use Nearby Search for all categories (including bars)
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLocation.latitude},${userLocation.longitude}&radius=${radius}&type=${categoryInfo.googleType}&key=${GOOGLE_PLACES_API_KEY}`;
      response = await fetch(url);
    }
    
    // Check if fetch failed (network error)
    if (!response.ok) {
      throw new Error('Network request failed. Please check your internet connection.');
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results) {
      const results = category === 'random' ? data.results : data.results;
      results.forEach((place: any) => {
        if (place.place_id) {
          placeIdMap.set(place.place_id, place);
        }
      });
    }
  } catch (error: any) {
    // Check if it's a network error
    if (error.message?.includes('Network') || error.message?.includes('fetch') || error.name === 'TypeError') {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    throw error;
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
 * @param distancePreferences Optional distance filtering for paid users
 * @returns The nearest place or null if not found
 */
export async function findNearestPlace(
  userLocation: Location,
  category: Category,
  distancePreferences?: { minDistanceMiles?: number; maxDistanceMiles?: number; enabled: boolean },
  categoryPreferences?: { restaurantCuisine?: string; barPriceLevel?: number }
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
    if (distancePreferences?.enabled) {
      console.log('Distance filter enabled:', {
        min: distancePreferences.minDistanceMiles ? `${distancePreferences.minDistanceMiles} mi` : 'none',
        max: distancePreferences.maxDistanceMiles ? `${distancePreferences.maxDistanceMiles} mi` : 'none',
      });
    }
    
    // Optimized search strategy:
    // - For non-distance queries: Limit to 20 results, search progressively if all filtered out
    // - For distance queries: Search progressively larger radii up to max distance needed
    const allResultsMap = new Map<string, any>();
    const MAX_RESULTS_FOR_NON_DISTANCE = 20; // Limit results for efficiency when no distance filter
    
    // Determine search radii based on distance preferences
    let searchRadiiToUse: number[];
    if (distancePreferences?.enabled && distancePreferences.maxDistanceMiles) {
      // For distance queries: Search up to max distance
      const maxMeters = distancePreferences.maxDistanceMiles * 1609.34;
      searchRadiiToUse = [1000, 5000, 10000];
      if (maxMeters > 10000) {
        // Add intermediate radii and cap at 50km
        const maxRadius = Math.min(maxMeters * 1.2, 50000);
        searchRadiiToUse.push(maxRadius);
      }
    } else {
      // For non-distance queries: Use standard progressive search (up to 10km)
      searchRadiiToUse = searchRadii;
    }
    
    // Search with progressive radii
    for (const radius of searchRadiiToUse) {
      console.log(`Searching with radius: ${radius}m`);
      const results = await searchWithRadius(userLocation, radius, category, categoryInfo, categoryPreferences);
      
      let newResults = 0;
      results.forEach((place: any) => {
        if (place.place_id && !allResultsMap.has(place.place_id)) {
          allResultsMap.set(place.place_id, place);
          newResults++;
        }
      });
      
      console.log(`  Found ${results.length} results (${newResults} new, ${allResultsMap.size} total)`);
      
      // For non-distance queries: Stop when we have 20 results
      // (We'll check later if they're all filtered out and search more if needed)
      if (!distancePreferences?.enabled && allResultsMap.size >= MAX_RESULTS_FOR_NON_DISTANCE) {
        console.log(`  Reached ${MAX_RESULTS_FOR_NON_DISTANCE} results, stopping search`);
        break;
      }
      
      // For distance queries: Continue searching all radii to find places in range
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
        distance: number; // Required, always calculated in feet
        placeId?: string;
        rawPlace?: any;
      }
      
      // Filter out recent places, places too close, and calculate distances
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
        const distanceMeters = calculateDistance(userLocation, placeLocation);
        const distanceFeet = distanceMeters * 3.28084; // Convert to feet for display
        return {
          name: place.name,
          location: placeLocation,
          address: place.vicinity || place.formatted_address,
          distance: distanceFeet, // Store in feet
          placeId: place.place_id,
          rawPlace: place, // Keep original for debugging
        };
      })
      .filter((place: PlaceWithDistance) => {
        // Filter out places that are too close (prevent immediate arrival trigger)
        if (place.distance < MIN_INITIAL_DISTANCE) {
          console.log(`Excluding place too close: ${place.name} - ${Math.round(place.distance)}ft (minimum: ${MIN_INITIAL_DISTANCE}ft)`);
          return false;
        }
        return true;
      });

      // For non-distance queries: If all results were filtered out, search larger radius
      if (placesWithDistance.length === 0 && !distancePreferences?.enabled) {
        console.log('All results were filtered out (recent places). Searching larger radius...');
        
        // Try progressively larger radii until we find valid results or reach reasonable limit
        const largerRadii = [20000, 30000]; // 20km, 30km
        for (const largerRadius of largerRadii) {
          console.log(`Searching with larger radius: ${largerRadius}m`);
          const additionalResults = await searchWithRadius(userLocation, largerRadius, category, categoryInfo, categoryPreferences);
          
          // Process only NEW results (not already in allResultsMap)
          const newPlacesWithDistance: PlaceWithDistance[] = additionalResults
            .filter((place: any) => {
              // Skip if already processed
              if (allResultsMap.has(place.place_id)) {
                return false;
              }
              // Skip if recent
              if (place.place_id && recentPlaceIds.includes(place.place_id)) {
                return false;
              }
              return true;
            })
            .map((place: any) => {
              // Add to map for tracking
              allResultsMap.set(place.place_id, place);
              
              const placeLocation: Location = {
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
              };
              const distanceMeters = calculateDistance(userLocation, placeLocation);
              const distanceFeet = distanceMeters * 3.28084;
              return {
                name: place.name,
                location: placeLocation,
                address: place.vicinity || place.formatted_address,
                distance: distanceFeet,
                placeId: place.place_id,
                rawPlace: place,
              };
            })
            .filter((place: PlaceWithDistance) => {
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
            break; // Found valid results, stop searching
          }
        }
        
        if (placesWithDistance.length === 0) {
          console.log('No valid places found even after searching larger radii. Returning null.');
          return null;
        }
      } else if (placesWithDistance.length === 0) {
        console.log('All results were filtered out. Returning null.');
        return null;
      }

      // Apply distance filtering for paid users if enabled
      // Note: place.distance is now in feet, so convert miles to feet for comparison
      let filteredPlaces = placesWithDistance;
      if (distancePreferences?.enabled) {
        const minDistanceFeet = distancePreferences.minDistanceMiles 
          ? distancePreferences.minDistanceMiles * 5280 
          : 0;
        const maxDistanceFeet = distancePreferences.maxDistanceMiles 
          ? distancePreferences.maxDistanceMiles * 5280 
          : Infinity;
        
        filteredPlaces = placesWithDistance.filter(place => {
          const inRange = place.distance >= minDistanceFeet && place.distance <= maxDistanceFeet;
          if (!inRange) {
            const distanceMiles = place.distance / 5280;
            console.log(`Filtered out ${place.name} - distance ${distanceMiles.toFixed(2)}mi is outside range (${distancePreferences.minDistanceMiles || 0}mi - ${distancePreferences.maxDistanceMiles || '∞'}mi)`);
          }
          return inRange;
        });
        
        console.log(`Distance filtering: ${placesWithDistance.length} places → ${filteredPlaces.length} places in range`);
      }

      // Apply bar price level filtering for paid users if enabled
      if (category === 'bars' && categoryPreferences?.barPriceLevel !== undefined) {
        const targetPriceLevel = categoryPreferences.barPriceLevel;
        filteredPlaces = filteredPlaces.filter(place => {
          // Google Places API returns price_level: 0, 1, 2, 3, or undefined
          const placePriceLevel = place.rawPlace?.price_level;
          if (placePriceLevel === undefined) {
            // If price level is not available, include it (to avoid filtering out too many results)
            return true;
          }
          const matches = placePriceLevel === targetPriceLevel;
          if (!matches) {
            console.log(`Filtered out ${place.name} - price level ${placePriceLevel} doesn't match ${targetPriceLevel}`);
          }
          return matches;
        });
        
        console.log(`Price level filtering: ${placesWithDistance.length} places → ${filteredPlaces.length} places with price level ${targetPriceLevel}`);
      }

      // Check if all results were filtered out by distance preferences
      if (filteredPlaces.length === 0) {
        console.log('All results were filtered out by distance preferences.');
        return null;
      }

      // Sort by distance to find the nearest
      filteredPlaces.sort((a: PlaceWithDistance, b: PlaceWithDistance) => a.distance - b.distance);

      console.log('\n=== All Places Found (sorted by distance) ===');
      filteredPlaces.forEach((p: PlaceWithDistance, index: number) => {
        const distanceMiles = p.distance / 5280;
        console.log(`${index + 1}. ${p.name}`);
        console.log(`   Distance: ${Math.round(p.distance)}ft (${distanceMiles.toFixed(2)}mi)`);
        console.log(`   Address: ${p.address || 'N/A'}`);
        console.log(`   Location: ${p.location.latitude}, ${p.location.longitude}`);
        console.log(`   Place ID: ${p.placeId || 'N/A'}`);
        console.log('');
      });

      // Get the nearest place (first after sorting)
      const nearestPlace = filteredPlaces[0];
      const nearestDistanceMiles = nearestPlace.distance / 5280;
      console.log('=== Selected Nearest Place ===');
      console.log('Name:', nearestPlace.name);
      console.log('Distance:', Math.round(nearestPlace.distance), 'ft (', nearestDistanceMiles.toFixed(2), 'mi)');

      // Extract photos from the raw place data
      let photos: string[] = [];
      if (nearestPlace.rawPlace?.photos && Array.isArray(nearestPlace.rawPlace.photos)) {
        // Get up to 3 photos
        photos = nearestPlace.rawPlace.photos
          .slice(0, 3)
          .map((photo: any) => {
            // Google Places Photo API URL
            // maxwidth=800 for good quality without being too large
            return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
          });
      }

      return {
        name: nearestPlace.name,
        location: nearestPlace.location,
        address: nearestPlace.address,
        distance: nearestPlace.distance,
        placeId: nearestPlace.placeId,
        photos: photos.length > 0 ? photos : undefined,
      };
    } else {
      console.log('No results found or API error:', data.status);
    }

    return null;
  } catch (error: any) {
    console.error('Error fetching nearest place:', error);
    
    // Check if it's a network/offline error
    if (error?.message?.toLowerCase().includes('internet') || 
        error?.message?.toLowerCase().includes('network') ||
        error?.name === 'TypeError' ||
        error?.message?.includes('fetch')) {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    // Re-throw the original error if it's not a network error
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

