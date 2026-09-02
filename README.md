# Pointme 🧭

A minimalist iOS (and Android) app that acts as a compass pointing you to the nearest bar, restaurant, liquor store, café, or random point of interest. Pick a category, follow the needle, arrive.

---

## How It Works

1. Select a category (bars, restaurants, liquor stores, cafés, or random)
2. The app finds the nearest matching place using your current location
3. A live compass needle points you toward it as you walk
4. When you're within ~82 feet, the arrival screen triggers

No maps, no turn-by-turn. Just a needle.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Expo (React Native) |
| Language | TypeScript |
| Navigation | expo-router |
| Location | expo-location |
| Device compass | expo-sensors (magnetometer) |
| POI data | Mapbox Search API (primary) / Google Places API (fallback) |
| Monetization | expo-iap / react-native-iap |
| Storage | AsyncStorage + expo-secure-store |
| Build/Deploy | EAS Build |

---

## Project Structure

```
├── screens/
│   ├── HomeScreen.tsx        # Category selection + place discovery
│   ├── CompassScreen.tsx     # Live compass pointing to target place
│   ├── ArrivalScreen.tsx     # Triggered when within arrival threshold
│   ├── PaywallScreen.tsx     # IAP paywall for premium features
│   └── SettingsScreen.tsx
├── services/
│   ├── mapboxPlaces.ts       # Primary POI search (Mapbox Search API)
│   ├── googlePlaces.ts       # Fallback POI search (Google Places API)
│   ├── geocoding.ts          # Coordinate utilities
│   ├── purchases.ts          # In-app purchase logic
│   ├── storage.ts            # AsyncStorage persistence
│   └── secureStorage.ts      # expo-secure-store for sensitive data
├── constants.ts              # Categories, thresholds, price/cuisine filters
├── types.ts                  # Shared TypeScript types
└── context/                  # React context providers
```

---

## Features

- **Compass navigation** — real-time bearing calculation using device magnetometer + Haversine formula
- **Category filters** — bars, restaurants, liquor stores, cafés, random
- **Cuisine filters** *(premium)* — Italian, Chinese, Mexican, Japanese, Indian, Thai, American, French
- **Price level filter** *(premium)* — $, $$, $$$
- **Arrival detection** — triggers arrival screen when within ~82 feet of destination
- **Recently visited avoidance** — skips places you've already been pointed to
- **Haptic feedback** on arrival
- **Review prompt** after 2+ arrivals

---

## Monetization

One-time purchase at $1.99 unlocks:
- Cuisine-specific restaurant filters
- Bar price level filters

Free tier includes 5 navigations before the paywall.

---

## Environment Variables

Copy `.env.template` to `.env` and fill in your keys:

```bash
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
GOOGLE_PLACES_API_KEY=your_google_places_key
```

Mapbox is the primary data source. Google Places is used as a fallback. A single Mapbox token works for both iOS and Android.

---

## Local Development

```bash
npm install
npx expo start
```

For device testing with tunnel:

```bash
npm run start:tunnel
```

---

## Building

Uses EAS Build. See `DEPLOYMENT_CHECKLIST.md` and `SETUP.md` for full build and App Store submission steps.

```bash
eas build --platform ios
eas build --platform android
```

---

## Arrival Threshold

The arrival screen triggers at **82 feet (~25 meters)**. New place suggestions require a minimum distance of **100 feet** to avoid immediately triggering arrival on the suggested place.
