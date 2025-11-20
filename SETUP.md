# Quick Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your Google Places API key:

```
GOOGLE_PLACES_API_KEY=your_actual_api_key_here
```

### Getting a Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Places API
   - Places API (New)
4. Go to "Credentials" and create an API key
5. (Optional) Restrict the API key to only the enabled APIs for security
6. Copy the API key to your `.env` file

**Note**: Google Places API requires billing to be enabled, but they offer $200 in free credits per month.

## 3. Run the App

```bash
npm start
```

Then:
- **iOS**: Press `i` or scan QR code with Expo Go app
- **Android**: Press `a` or scan QR code with Camera app
- **Web**: Press `w` (limited functionality - location and sensors won't work)

## 4. Test in Expo Go

The app is designed to work in Expo Go for quick testing. Make sure you:
- Grant location permissions when prompted
- Allow "Precise Location" for best results
- Test on a real device (simulators have limited sensor support)

## Troubleshooting

### "Google Places API key is not configured"

- Make sure `.env` file exists in the root directory
- Verify the API key is correct (no extra spaces)
- Restart the Expo dev server after creating/editing `.env`
- Check that the API key has Places API enabled

### Compass not working

- Test on a real device (magnetometer doesn't work well in simulators)
- Calibrate your device's compass by moving it in a figure-8 pattern
- Ensure location permissions include "Precise Location"

### No places found

- Check your internet connection
- Verify Google Places API is enabled and billing is set up
- Try a different category or location
- Check API quotas in Google Cloud Console

## Next Steps

- See `README.md` for full documentation
- Customize categories in `constants.ts`
- Adjust arrival threshold in `constants.ts` (ARRIVAL_DISTANCE_THRESHOLD)

