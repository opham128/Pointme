export type Category = 
  | 'bars'
  | 'restaurants'
  | 'liquor_stores'
  | 'cafes'
  | 'random';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Place {
  name: string;
  location: Location;
  address?: string;
  distance?: number; // in meters
  placeId?: string;
  photos?: string[]; // Array of photo URLs
}

export interface CompassState {
  userLocation: Location | null;
  targetPlace: Place | null;
  selectedCategory: Category | null;
  heading: number; // degrees (0-360)
  bearing: number; // degrees from user to target
}

