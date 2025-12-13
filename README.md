# Pointme - Compass to Nearest Target App

A beautiful Expo React Native app that functions like a directional compass, pointing users to the nearest location of a chosen category. Built with TypeScript, Expo, and React Native.

## 🎯 Features

- **Location Permissions**: Graceful handling of location permissions with retry screens
- **Category Selection**: Choose from Bars, Restaurants, Liquor Stores, Cafés, and Random (fun things to do)
- **Nearest Place Finding**: Uses Google Places API to find the closest location
- **Compass Navigation**: Real-time compass with magnetometer + GPS heading
- **Arrival Detection**: Automatic detection when within 25 meters with celebration animation
- **Beautiful UI**: Minimal Apple-like interface with light/dark mode support

## 📦 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your iOS/Android device (for testing)
- Google Places API key ([Get one here](https://developers.google.com/maps/documentation/places/web-service/get-api-key))

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google Places API Key

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Google Places API key:
   ```
   GOOGLE_PLACES_API_KEY=your_actual_api_key_here
   ```

3. **Important**: Make sure your Google Places API key has the following APIs enabled:
   - Places API
   - Places API (New)
   - Geocoding API (optional, for better address formatting)

### 3. Run the App

#### Development Mode (Expo Go)

```bash
npm start
```

Then:
- Scan the QR code with Expo Go app (iOS) or Camera app (Android)
- Or press `i` for iOS simulator / `a` for Android emulator

#### Platform-Specific

```bash
# iOS
npm run ios

# Android
npm run android
```

## 📁 Project Structure

```
/app
  /screens
    HomeScreen.tsx          # Category selection screen
    CompassScreen.tsx        # Main compass navigation screen
    ArrivalScreen.tsx        # Arrival celebration screen
  /components
    CategoryButton.tsx       # Category selection button
    CompassNeedle.tsx        # Animated compass needle
    ConfettiAnimation.tsx    # Arrival celebration animation
  /hooks
    useHeading.ts           # Magnetometer/GPS heading hook
    useNearestPlace.ts      # Google Places API hook
    useDistance.ts          # Distance calculation hook
    useLocation.ts          # Location permissions & tracking hook
  /services
    googlePlaces.ts         # Google Places API integration
  /context
    AppContext.tsx          # Global app state management
  types.ts                  # TypeScript type definitions
  constants.ts              # App constants and category definitions
```

## 🧭 How It Works

### Compass Logic

The app calculates the bearing from the user's location to the target using the formula:

```
bearing = atan2(
  sin(dLon) * cos(lat2),
  cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(dLon)
)
```

The compass needle rotates based on the difference between the target bearing and the user's current heading:

```
rotation = bearing - userHeading
```

### Finding Nearest Places

The app uses Google Places API's Nearby Search endpoint:
- Searches within 5km radius
- Filters by category type
- Returns the nearest result sorted by distance

### Arrival Detection

When the user is within 25 meters of the target:
- Triggers confetti animation
- Reveals the location name
- Shows "You've Arrived!" message
- Provides options to open in Maps or choose another destination

## 🎨 Adding New Categories

To add a new category, edit `constants.ts`:

```typescript
export const CATEGORIES: Record<Category, {...}> = {
  // ... existing categories
  your_category: {
    label: 'Your Category',
    emoji: '🎯',
    googleType: 'google_place_type', // See Google Places API types
  },
};
```

Then add the category to the `Category` type in `types.ts`.

## 🧪 Testing

The app works in Expo Go for quick testing. For production builds:

```bash
# Build with EAS
eas build --platform ios
eas build --platform android
```

## 📱 Building for Production

### Using EAS Build

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login:
   ```bash
   eas login
   ```

3. Configure:
   ```bash
   eas build:configure
   ```

4. Build:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

## 🔧 Troubleshooting

### Location Not Working

- Ensure location permissions are granted in device settings
- For iOS simulator, set a custom location in Features > Location
- For Android emulator, use the extended controls to set location

### Google Places API Errors

- Verify your API key is correct in `.env`
- Check that Places API is enabled in Google Cloud Console
- Ensure billing is enabled (Google requires billing for Places API)
- Check API quotas and limits

### Compass Not Rotating

- Ensure device has a magnetometer (most modern devices do)
- Try calibrating the compass by moving device in a figure-8 pattern
- Check that location permissions include "precise location"

## 📝 Environment Variables

Create a `.env` file in the root directory:

```
GOOGLE_PLACES_API_KEY=your_key_here
```

**Note**: Never commit your `.env` file to version control. It's already in `.gitignore`.

## 🛠️ Technologies Used

- **Expo** (~51.0.0) - React Native framework
- **expo-router** (~3.5.0) - File-based routing
- **expo-location** (~17.0.1) - Location services
- **expo-sensors** (~13.0.0) - Magnetometer access
- **react-native-reanimated** (~3.10.1) - Smooth animations
- **react-native-confetti-cannon** - Celebration animations
- **TypeScript** - Type safety
- **Jotai** - State management (via React Context)

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

**Note**: This app requires an active internet connection and location services to function properly.
