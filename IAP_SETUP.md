# In-App Purchase Setup Guide

This guide will help you set up in-app purchases for both iOS (App Store) and Android (Google Play).

## Product ID

The app uses the product ID: **`unlock_full_app`**

This is a one-time purchase (non-consumable) priced at **$2.99**.

---

## iOS Setup (App Store Connect)

### 1. Create the In-App Purchase Product

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to your app → **Features** → **In-App Purchases**
3. Click the **+** button to create a new in-app purchase
4. Select **Non-Consumable** (one-time purchase)
5. Fill in the details:
   - **Product ID**: `unlock_full_app` (must match exactly)
   - **Reference Name**: "Unlock Full App" (internal name, can be anything)
   - **Display Name**: "Unlock Full App"
   - **Description**: "Unlock unlimited locations and all features"
   - **Price**: $2.99 USD
6. Add a screenshot (optional but recommended)
7. Click **Save**

### 2. Submit for Review

- The in-app purchase must be submitted for review along with your app
- Make sure the product status is **"Ready to Submit"** before submitting your app

### 3. Testing

- Use a **Sandbox Tester** account (create in Users and Access → Sandbox Testers)
- Test purchases won't charge real money
- You can test on a physical device or simulator

---

## Android Setup (Google Play Console)

### 1. Create the In-App Product

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app → **Monetize** → **Products** → **In-app products**
3. Click **Create product**
4. Fill in the details:
   - **Product ID**: `unlock_full_app` (must match exactly)
   - **Name**: "Unlock Full App"
   - **Description**: "Unlock unlimited locations and all features"
   - **Price**: $2.99 USD (or your local equivalent)
   - **Status**: **Active**
5. Click **Save**

### 2. Testing

- Use a **License Tester** account (Settings → Account details → License testing)
- Add your test Gmail account
- Test purchases won't charge real money
- Test on a physical device or emulator

---

## Important Notes

### Product ID Consistency

The product ID `unlock_full_app` is defined in:
- `services/purchases.ts` (line 5)
- Must match exactly in both App Store Connect and Google Play Console

### Testing Checklist

- [ ] Product created in App Store Connect with ID `unlock_full_app`
- [ ] Product created in Google Play Console with ID `unlock_full_app`
- [ ] Product status is Active/Ready to Submit
- [ ] Tested purchase flow on iOS (Sandbox)
- [ ] Tested purchase flow on Android (License Tester)
- [ ] Tested restore purchases functionality
- [ ] Verified purchase persists after app restart

### Common Issues

1. **"Product not found"**
   - Verify product ID matches exactly: `unlock_full_app`
   - Ensure product is Active/Ready to Submit
   - Wait a few minutes after creating the product (propagation delay)

2. **"Purchases not available"**
   - Check device has internet connection
   - Verify you're signed in with a valid account (Sandbox for iOS, License Tester for Android)
   - Ensure the app is properly configured with the IAP plugin

3. **Purchase doesn't persist**
   - Check AsyncStorage permissions
   - Verify `savePurchaseStatus` is being called
   - Check device storage space

### After Setup

1. Rebuild your app with `npx expo prebuild` (if using bare workflow) or `eas build`
2. Test thoroughly before submitting to stores
3. The paywall will automatically appear after 5 free locations

---

## Free Limit

The app allows **5 free locations** before showing the paywall. This is configured in:
- `constants.ts`: `FREE_LOCATIONS_LIMIT = 5`

You can adjust this value if needed.

---

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify product IDs match exactly
3. Ensure products are Active in both stores
4. Test with Sandbox/License Tester accounts first

