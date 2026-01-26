# Pre-Deployment Checklist

## ✅ Platform Compatibility Check

### iOS Compatibility
- ✅ **Location Permissions**: Configured in `app.json` and `Info.plist`
- ✅ **Google Maps Integration**: `LSApplicationQueriesSchemes` includes `comgooglemaps`
- ✅ **In-App Purchases**: Uses `expo-in-app-purchases` (iOS compatible)
- ✅ **Haptics**: Uses `expo-haptics` (iOS compatible)
- ✅ **Sensors**: Uses `expo-sensors` for magnetometer (iOS compatible)
- ✅ **Bundle ID**: `com.pointme.app` configured

### Android Compatibility
- ✅ **Location Permissions**: Configured in `app.json` and `AndroidManifest.xml`
- ✅ **Google Maps Integration**: Uses web URL (works on Android)
- ✅ **In-App Purchases**: Uses `expo-in-app-purchases` (Android compatible)
- ✅ **Haptics**: Uses `expo-haptics` (Android compatible)
- ✅ **Sensors**: Uses `expo-sensors` for magnetometer (Android compatible)
- ✅ **Package Name**: `com.pointme.app` configured
- ✅ **Adaptive Icon**: Configured in `app.json`

### Platform-Specific Code
- ✅ Only one platform check found: `Platform.OS` in `PaywallScreen.tsx` for payment text (handles both iOS and Android correctly)

## ⚠️ Issues Found

### 1. Price Mismatch
- **Issue**: `IAP_SETUP.md` mentions $2.99, but `constants.ts` has `PURCHASE_PRICE = 1.99`
- **Action**: Update `IAP_SETUP.md` to reflect $1.99, or update `constants.ts` to $2.99

### 2. Google Maps Opening
- **Current**: Uses web URL through Safari (works on both platforms)
- **Note**: Direct app opening was reverted due to issues - current implementation is cross-platform compatible

## 📋 Required Before App Store Submission

### iOS (App Store Connect)

#### 1. App Information
- [ ] App name: "Pointme"
- [ ] Subtitle (optional)
- [ ] Category: Navigation or Travel
- [ ] Age rating: 4+ (likely)
- [ ] App description (at least 1 language)
- [ ] Keywords for search
- [ ] Support URL (required)
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL (REQUIRED - see below)

#### 2. App Store Listing
- [ ] App icon (1024x1024px, no transparency)
- [ ] Screenshots (required for iPhone):
  - 6.7" display (iPhone 14 Pro Max, etc.)
  - 6.5" display (iPhone 11 Pro Max, etc.)
  - 5.5" display (iPhone 8 Plus, etc.)
- [ ] App preview video (optional but recommended)
- [ ] Description (up to 4000 characters)
- [ ] What's New (for updates)

#### 3. In-App Purchase Setup
- [ ] Create product in App Store Connect:
  - Product ID: `unlock_full_app`
  - Type: Non-Consumable
  - Price: $1.99 (match `constants.ts`)
  - Status: Ready to Submit
- [ ] Submit IAP for review (with app)

#### 4. Privacy & Compliance
- [ ] **Privacy Policy URL** (REQUIRED)
  - Must be publicly accessible
  - Must explain what data you collect (location data)
  - Must explain how you use it (finding nearby places)
  - Must explain third-party services (Google Places API)
- [ ] Privacy Nutrition Labels:
  - Location data collection
  - Third-party advertising (if applicable)
- [ ] App Privacy Details:
  - Data types collected: Location
  - Purpose: App Functionality
  - Linked to user: No (if anonymized)
  - Used for tracking: No

#### 5. Build & Testing
- [ ] Create production build with EAS:
  ```bash
  eas build --platform ios --profile production
  ```
- [ ] Test on physical device
- [ ] Test in-app purchase with Sandbox account
- [ ] Test restore purchases
- [ ] Test all features (compass, arrival, paywall)

#### 6. App Review Information
- [ ] Demo account (if needed)
- [ ] Notes for reviewer
- [ ] Contact information
- [ ] Sign in information (if applicable)

### Android (Google Play Console)

#### 1. App Information
- [ ] App name: "Pointme"
- [ ] Short description (80 characters max)
- [ ] Full description (4000 characters max)
- [ ] App icon (512x512px)
- [ ] Feature graphic (1024x500px)
- [ ] Screenshots:
  - Phone (at least 2, up to 8)
  - Tablet (optional)
- [ ] App category: Navigation or Travel
- [ ] Content rating questionnaire

#### 2. Store Listing
- [ ] App description
- [ ] Graphics (icon, feature graphic, screenshots)
- [ ] Promotional text (optional)
- [ ] What's new (for updates)

#### 3. In-App Purchase Setup
- [ ] Create product in Google Play Console:
  - Product ID: `unlock_full_app`
  - Type: Managed Product (non-consumable)
  - Price: $1.99 (match `constants.ts`)
  - Status: Active
- [ ] Set up pricing for all countries

#### 4. Privacy & Compliance
- [ ] **Privacy Policy URL** (REQUIRED)
  - Must be publicly accessible
  - Must explain data collection and usage
  - Must explain third-party services
- [ ] Data Safety section:
  - Data types: Location
  - Purpose: App functionality
  - Data sharing: Google Places API
- [ ] Target audience and content
- [ ] Content rating

#### 5. Build & Testing
- [ ] Create production build with EAS:
  ```bash
  eas build --platform android --profile production
  ```
- [ ] Test on physical device
- [ ] Test in-app purchase with License Tester account
- [ ] Test restore purchases
- [ ] Test all features

#### 6. App Signing
- [ ] Set up Play App Signing (recommended)
- [ ] Upload signing key (or use Google's managed signing)

## 🔒 Security & API Keys

### Google Places API
- [ ] **API Key Restrictions** (CRITICAL):
  - Configure in [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
  - Restrict by iOS bundle ID: `com.pointme.app`
  - Restrict by Android package name: `com.pointme.app`
  - Restrict by Android app SHA-1 certificate fingerprint (get from Google Play Console or keystore)
  - Restrict to only "Places API" (not all Google APIs)
  - See `GOOGLE_API_KEY_SETUP.md` for detailed instructions
- [ ] Add API key to EAS secrets:
  ```bash
  eas secret:create --scope project --name GOOGLE_PLACES_API_KEY --value YOUR_KEY
  ```
- [ ] Update `.env` or use EAS secrets in production
- [ ] Never commit API keys to git

### Environment Variables
- [ ] Set up EAS secrets for production
- [ ] Remove hardcoded API keys
- [ ] Use environment variables in production builds

## 📝 Legal Requirements

### Privacy Policy (REQUIRED)
You **must** create a privacy policy that covers:
1. **Data Collection**:
   - Location data (GPS coordinates)
   - How location is used (finding nearby places)
   - When location is collected (when app is in use)
2. **Third-Party Services**:
   - Google Places API
   - What data is shared with Google
   - Google's privacy policy link
3. **Data Storage**:
   - Local storage (arrival history, preferences)
   - No server-side storage mentioned
4. **User Rights**:
   - How to delete data (clear storage)
   - Contact information

**Privacy Policy Generator Options**:
- [Privacy Policy Generator](https://www.privacypolicygenerator.info/)
- [Termly](https://termly.io/)
- [iubenda](https://www.iubenda.com/)

### Terms of Service (Optional but Recommended)
Consider adding:
- App usage terms
- Purchase terms
- Limitation of liability
- User responsibilities

## 🧪 Testing Checklist

### Functionality Testing
- [ ] Location permission request works
- [ ] Compass points to destination correctly
- [ ] Distance calculation accurate
- [ ] Arrival detection works (82 feet threshold)
- [ ] Paywall appears after 5 locations
- [ ] Purchase flow works
- [ ] Restore purchases works
- [ ] Offline handling works
- [ ] Error messages are user-friendly

### Platform-Specific Testing
- [ ] iOS: Test on iPhone (multiple models if possible)
- [ ] Android: Test on multiple Android versions
- [ ] Test on different screen sizes
- [ ] Test with poor network conditions
- [ ] Test location accuracy in different environments

### Edge Cases
- [ ] No internet connection
- [ ] Location permission denied
- [ ] Location services disabled
- [ ] No places found
- [ ] API rate limits
- [ ] App backgrounded/foregrounded

## 📦 Build Configuration

### EAS Build Setup
- [ ] Review `eas.json` configuration
- [ ] Set up production build profiles
- [ ] Configure code signing (iOS)
- [ ] Configure app signing (Android)
- [ ] Set up environment variables

### Version Management
- [ ] Update version in `app.json` (currently 1.0.0)
- [ ] Update build number for each release
- [ ] Use semantic versioning

## 🚀 Deployment Steps

### iOS
1. Create production build: `eas build --platform ios --profile production`
2. Upload to App Store Connect (or use EAS Submit)
3. Complete App Store Connect listing
4. Submit for review
5. Wait for approval (typically 1-3 days)

### Android
1. Create production build: `eas build --platform android --profile production`
2. Upload to Google Play Console
3. Complete store listing
4. Submit for review
5. Wait for approval (typically 1-7 days)

## 📊 Post-Launch

### Monitoring
- [ ] Set up crash reporting (Sentry, Firebase Crashlytics)
- [ ] Set up analytics (optional but recommended)
- [ ] Monitor API usage and costs
- [ ] Monitor in-app purchase success rate

### Updates
- [ ] Plan for bug fixes
- [ ] Plan for feature updates
- [ ] Keep dependencies updated
- [ ] Monitor security advisories

## ⚠️ Critical Items

1. **Privacy Policy** - REQUIRED for both stores
2. **API Key Restrictions** - Critical for security
3. **IAP Product Setup** - Must match product ID exactly
4. **Testing** - Test on real devices before submission
5. **Build Configuration** - Ensure production builds work

## 📚 Resources

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy](https://play.google.com/about/developer-content-policy/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo In-App Purchases](https://docs.expo.dev/versions/latest/sdk/in-app-purchases/)
