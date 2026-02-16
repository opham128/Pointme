# Google Places API Key Security Setup

This guide shows you how to secure your Google Places API key for production deployment.

## 🔐 Where to Configure: Google Cloud Console

All API key restrictions are configured in the **Google Cloud Console**, not in your app code.

### Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if you haven't)
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Find Your API Key

1. In the Credentials page, find your Google Places API key
2. Click on the API key name to edit it

### Step 3: Create Two Separate API Keys

**Recommended Approach: Use separate keys for iOS and Android**

This provides better security and isolation. Create two keys:

#### Create iOS API Key:
1. Click **"Create Credentials"** → **"API Key"**
2. Name it: `Pointme iOS Key`
3. Click **"Restrict key"** to configure restrictions

**Application Restrictions:**
1. Select **"iOS apps"** from the dropdown
2. Click **"Add an item"**
3. Enter your bundle identifier: `com.pointme.app`
4. Click **"Done"**

**API Restrictions:**
1. Select **"Restrict key"** under API restrictions
2. Select **"Restrict key to selected APIs"**
3. Check ONLY:
   - ✅ **Places API** (this covers Nearby Search, Text Search, and Photos)
4. Uncheck all other APIs
5. Click **"Save"**
6. **Copy the iOS API key** - you'll need it for your `.env` file

#### Create Android API Key:
1. Click **"Create Credentials"** → **"API Key"**
2. Name it: `Pointme Android Key`
3. Click **"Restrict key"** to configure restrictions

**Application Restrictions:**
1. Select **"Android apps"** from the dropdown
2. Click **"Add an item"**
3. Enter:
   - **Package name**: `com.pointme.app`
   - **SHA-1 certificate fingerprint**: (see below for how to get this)
4. Click **"Done"**

**API Restrictions:**
1. Select **"Restrict key"** under API restrictions
2. Select **"Restrict key to selected APIs"**
3. Check ONLY:
   - ✅ **Places API** (this covers Nearby Search, Text Search, and Photos)
4. Uncheck all other APIs
5. Click **"Save"**
6. **Copy the Android API key** - you'll need it for your `.env` file


### Step 4: Configure Environment Variables

Add both API keys to your `.env` file:

```bash
# Platform-specific keys (recommended for production)
GOOGLE_PLACES_API_KEY_IOS=your_ios_api_key_here
GOOGLE_PLACES_API_KEY_ANDROID=your_android_api_key_here

# Fallback key (optional, for development)
GOOGLE_PLACES_API_KEY=your_fallback_key_here
```

**Note:** The app will automatically use the platform-specific key based on whether it's running on iOS or Android. If platform-specific keys aren't set, it falls back to `GOOGLE_PLACES_API_KEY`.

### Step 5: Get Android SHA-1 Fingerprint

You need the SHA-1 certificate fingerprint for your Android app. This depends on whether you're using:
- **Google Play App Signing** (recommended) - Use Google's certificate
- **Your own signing key** - Use your keystore's certificate

#### Option A: Using Google Play App Signing (Recommended)

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Release** → **Setup** → **App signing**
4. Copy the **SHA-1 certificate fingerprint** from the "App signing key certificate" section
5. Use this fingerprint in Google Cloud Console

#### Option B: Using Your Own Keystore

If you're signing the app yourself, get the SHA-1 from your keystore:

```bash
# For debug keystore (testing)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# For production keystore (replace with your keystore path)
keytool -list -v -keystore /path/to/your/keystore.jks -alias your-key-alias
```

Look for the **SHA1** value in the output.

#### Option C: Get from EAS Build

If you're using EAS Build, you can get the SHA-1 from EAS:

```bash
# Get your app's credentials
eas credentials

# Or check the build output for certificate information
```

**Note**: If you're using Google Play App Signing, you'll need to add BOTH:
1. Upload key certificate SHA-1 (for testing)
2. App signing key certificate SHA-1 (for production - from Play Console)

### Step 5: Save Changes

1. Click **"Save"** at the bottom of the page
2. Wait a few minutes for changes to propagate (usually 1-5 minutes)

## 🔑 Using EAS Secrets for Production

Instead of hardcoding your API key, use EAS Secrets for production builds.


## 📋 Complete Setup Checklist

- [x] API key created in Google Cloud Console
- [x] Places API enabled in Google Cloud Console
- [ ] iOS restriction added (bundle ID: `com.pointme.app`)
- [ ] Android restriction added (package: `com.pointme.app`)
- [ ] Android SHA-1 fingerprint added (from Play Console or keystore)
- [ ] API restrictions set (only Places API enabled)
- [ ] Changes saved in Google Cloud Console
- [ ] EAS secret created for production builds
- [ ] Tested API key works with restrictions

## ⚠️ Important Notes

1. **Propagation Delay**: API key restrictions can take 1-5 minutes to take effect
2. **Platform-Specific Keys**: The app automatically uses the correct key based on the platform (iOS/Android)
3. **Fallback Key**: If platform-specific keys aren't set, the app falls back to `GOOGLE_PLACES_API_KEY`
4. **Testing**: Test your API keys on both platforms after adding restrictions
5. **Backup**: Keep backups of both API keys in a secure location
6. **Quotas**: Set up usage quotas in Google Cloud Console to prevent unexpected costs (see below)

## 💰 Setting Up API Quotas & Limits

**Why set quotas?** Prevents unexpected charges if your API key is compromised or if there's a bug causing excessive API calls.

### Step 1: Access Quotas in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **APIs & Services** → **Dashboard**
4. Click on **Places API** (or search for it in the API Library)
5. Click on the **"Quotas"** tab

### Step 2: Set Request Limits

**Recommended limits for a small app:**

1. **Requests per day**: 
   - Set to a reasonable limit (e.g., 10,000 requests/day)
   - This covers ~500-1,000 searches per day (each search = 2-10 API calls)

2. **Requests per minute**:
   - Set to 100-200 requests/minute
   - Prevents burst usage from causing issues

3. **Requests per user per 100 seconds**:
   - Set to 50-100 requests
   - Prevents a single user from making too many rapid requests

### Step 3: Set Up Billing Alerts

1. Go to **Billing** → **Budgets & alerts**
2. Create a budget:
   - Set monthly budget (e.g., $10-20)
   - Add email alerts at 50%, 90%, and 100%
   - This will notify you if spending approaches your limit

### Step 4: Monitor Usage

1. Go to **APIs & Services** → **Dashboard**
2. View **Places API** usage metrics
3. Check **Billing** → **Reports** for cost breakdown

**Note**: Google provides $200 in free credits per month. Monitor your usage to stay within this if possible.
7. **Development**: For local development, you can use a single unrestricted key in `.env` as `GOOGLE_PLACES_API_KEY`

## 🧪 Testing Restrictions

After setting up restrictions:

1. **Test on iOS device**: Build and test on a real iOS device
2. **Test on Android device**: Build and test on a real Android device
3. **Verify API calls work**: Make sure location searches still work
4. **Check console**: Monitor Google Cloud Console for API usage

## 🔍 Troubleshooting

### "API key not valid" error
- Check that restrictions match exactly (bundle ID, package name, SHA-1)
- Wait a few minutes for propagation
- Verify Places API is enabled in your project

### "This API key is not authorized" error
- Check API restrictions include Places API
- Verify you've enabled Places API in the API Library

### Android SHA-1 mismatch
- If using Google Play App Signing, use the App Signing key SHA-1 (not upload key)
- Double-check the SHA-1 is copied correctly (no spaces, correct format)

## 📚 Additional Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
