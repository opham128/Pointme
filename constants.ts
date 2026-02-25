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

export const ARRIVAL_DISTANCE_THRESHOLD = 82; // feet (approximately 25 meters) — arrival screen triggers when within this
/** Minimum distance for a suggested place (feet). Must be > ARRIVAL_DISTANCE_THRESHOLD so we don't suggest a place that would trigger arrival immediately. */
export const MIN_INITIAL_DISTANCE = ARRIVAL_DISTANCE_THRESHOLD + 18; // 100 feet

// Restaurant cuisine types (for paid users)
export const RESTAURANT_CUISINES = [
  { value: 'italian', label: 'Italian', googleType: 'italian_restaurant' },
  { value: 'chinese', label: 'Chinese', googleType: 'chinese_restaurant' },
  { value: 'mexican', label: 'Mexican', googleType: 'mexican_restaurant' },
  { value: 'japanese', label: 'Japanese', googleType: 'japanese_restaurant' },
  { value: 'indian', label: 'Indian', googleType: 'indian_restaurant' },
  { value: 'thai', label: 'Thai', googleType: 'thai_restaurant' },
  { value: 'american', label: 'American', googleType: 'american_restaurant' },
  { value: 'french', label: 'French', googleType: 'french_restaurant' },
] as const;

// Bar price levels (for paid users)
export const BAR_PRICE_LEVELS = [
  { value: 0, label: '$', description: 'Budget-friendly' },
  { value: 1, label: '$$', description: 'Moderate' },
  { value: 2, label: '$$$', description: 'Expensive' },
] as const;

export const GOOGLE_PLACES_API_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Monetization
export const FREE_LOCATIONS_LIMIT = 5; // Number of free locations before paywall
export const PURCHASE_PRICE = 1.99; // Price in USD


export { Category };
