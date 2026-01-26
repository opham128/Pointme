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

### Step 3: Configure Restrictions

Click **"Restrict key"** or **"Edit"** to configure restrictions:

#### A. Application Restrictions

**For iOS:**
1. Select **"iOS apps"** from the dropdown
2. Click **"Add an item"**
3. Enter your bundle identifier: `com.pointme.app`
4. Click **"Done"**

**For Android:**
1. Select **"Android apps"** from the dropdown
2. Click **"Add an item"**
3. Enter:
   - **Package name**: `com.pointme.app`
   - **SHA-1 certificate fingerprint**: (see below for how to get this)
4. Click **"Done"**

**Important**: You need to add BOTH iOS and Android restrictions if you're deploying to both platforms.

#### B. API Restrictions

1. Select **"Restrict key"** under API restrictions
2. Select **"Restrict key to selected APIs"**
3. Check ONLY:
   - ✅ **Places API** (or **Places API (New)** if available)
   - ✅ **Maps JavaScript API** (if you use it for photos)
4. Uncheck all other APIs
5. Click **"Save"**

### Step 4: Get Android SHA-1 Fingerprint

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

### Step 1: Create EAS Secret

```bash
# Install EAS CLI if you haven't
npm install -g eas-cli

# Login to EAS
eas login

# Create a secret for your API key
eas secret:create --scope project --name GOOGLE_PLACES_API_KEY --value YOUR_ACTUAL_API_KEY
```

### Step 2: Update Your Code (if needed)

Your code already uses environment variables from `.env`. For production builds, EAS will automatically inject secrets that match environment variable names.

### Step 3: Verify in Build

The secret will be available as `process.env.GOOGLE_PLACES_API_KEY` in your production builds.

## 📋 Complete Setup Checklist

- [ ] API key created in Google Cloud Console
- [ ] Places API enabled in Google Cloud Console
- [ ] iOS restriction added (bundle ID: `com.pointme.app`)
- [ ] Android restriction added (package: `com.pointme.app`)
- [ ] Android SHA-1 fingerprint added (from Play Console or keystore)
- [ ] API restrictions set (only Places API enabled)
- [ ] Changes saved in Google Cloud Console
- [ ] EAS secret created for production builds
- [ ] Tested API key works with restrictions

## ⚠️ Important Notes

1. **Propagation Delay**: API key restrictions can take 1-5 minutes to take effect
2. **Multiple Keys**: Consider using separate API keys for:
   - Development/testing
   - Production
3. **Testing**: Test your API key after adding restrictions to ensure it still works
4. **Backup**: Keep a backup of your API key in a secure location
5. **Quotas**: Set up usage quotas in Google Cloud Console to prevent unexpected costs

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
