declare module '@env' {
  export const EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: string;
  // Legacy Google keys (kept for backward compatibility if needed)
  export const GOOGLE_PLACES_API_KEY: string;
  export const GOOGLE_PLACES_API_KEY_IOS: string;
  export const GOOGLE_PLACES_API_KEY_ANDROID: string;
}

declare module 'react-native-dotenv' {
  export const EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: string;
  // Legacy Google keys (kept for backward compatibility if needed)
  export const GOOGLE_PLACES_API_KEY: string;
  export const GOOGLE_PLACES_API_KEY_IOS: string;
  export const GOOGLE_PLACES_API_KEY_ANDROID: string;
}

