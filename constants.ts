import { Category } from './types';

export const CATEGORIES: Record<Category, { label: string; emoji: string; googleType: string }> = {
  bars: {
    label: 'Bars',
    emoji: '🍺',
    googleType: 'bar',
  },
  restaurants: {
    label: 'Restaurants',
    emoji: '🍽️',
    googleType: 'restaurant',
  },
  liquor_stores: {
    label: 'Liquor Stores',
    emoji: '🍷',
    googleType: 'liquor_store',
  },
  cafes: {
    label: 'Cafés',
    emoji: '☕',
    googleType: 'cafe',
  },
  random: {
    label: 'Random',
    emoji: '🎲',
    googleType: 'tourist_attraction', // Base type, but we'll use text search for variety
  },
};

export const ARRIVAL_DISTANCE_THRESHOLD = 25; // meters

export const GOOGLE_PLACES_API_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Monetization
export const FREE_LOCATIONS_LIMIT = 5; // Number of free locations before paywall
export const PURCHASE_PRICE = 2.99; // Price in USD


export { Category };
