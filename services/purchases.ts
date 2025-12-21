import AsyncStorage from '@react-native-async-storage/async-storage';

const PURCHASE_STATUS_KEY = '@pointme:purchase_status';
const PURCHASE_PRODUCT_ID = 'unlock_full_app'; // You'll need to create this in App Store Connect and Google Play Console

// Dynamically import to handle Expo Go (where native modules aren't available)
let InAppPurchases: typeof import('expo-in-app-purchases') | null = null;

try {
  InAppPurchases = require('expo-in-app-purchases');
} catch (error) {
  // Native module not available (e.g., in Expo Go)
  console.warn('expo-in-app-purchases not available - running in Expo Go or development mode');
}

export interface PurchaseStatus {
  hasPurchased: boolean;
  purchaseDate?: number;
  transactionId?: string;
}

// Global purchase listener promise resolvers
let purchaseResolvers: Array<{
  resolve: (value: { success: boolean; error?: string }) => void;
  reject: (error: any) => void;
}> = [];

// Set up global purchase listener (should be called once at app startup)
let isListenerSetup = false;

function setupPurchaseListener() {
  if (isListenerSetup || !InAppPurchases) return;
  
  InAppPurchases.setPurchaseListener(
    async ({ responseCode, results, errorCode }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        // Process all purchases
        if (results && results.length > 0) {
          for (const purchase of results) {
            // Only process unacknowledged purchases
            if (!purchase.acknowledged && purchase.productId === PURCHASE_PRODUCT_ID) {
              // Save purchase status
              await savePurchaseStatus({
                hasPurchased: true,
                purchaseDate: purchase.purchaseTime || Date.now(),
                transactionId: purchase.orderId || purchase.transactionReceipt,
              });

              // Finish the transaction (false = non-consumable)
              if (InAppPurchases) {
                await InAppPurchases.finishTransactionAsync(purchase, false);
              }

              // Resolve all pending purchase promises
              purchaseResolvers.forEach(({ resolve }) => {
                resolve({ success: true });
              });
              purchaseResolvers = [];
              return;
            }
          }
        }
      } else {
        // Purchase failed or was cancelled
        const errorMessage =
          responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED
            ? 'Purchase cancelled'
            : `Purchase failed: ${errorCode || responseCode}`;

        purchaseResolvers.forEach(({ resolve }) => {
          resolve({ success: false, error: errorMessage });
        });
        purchaseResolvers = [];
      }
    }
  );
  
  isListenerSetup = true;
}

/**
 * Initialize the in-app purchase connection
 */
export async function initializePurchases(): Promise<boolean> {
  if (!InAppPurchases) {
    console.warn('In-app purchases not available (Expo Go or development mode)');
    return false;
  }
  
  try {
    await InAppPurchases.connectAsync();
    const responseCode = await InAppPurchases.getBillingResponseCodeAsync();
    
    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      console.warn('In-app purchases are not available on this device');
      return false;
    }

    // Set up the purchase listener
    setupPurchaseListener();
    
    return true;
  } catch (error) {
    console.error('Error initializing purchases:', error);
    return false;
  }
}

/**
 * Disconnect from the purchase service
 */
export async function disconnectPurchases(): Promise<void> {
  if (!InAppPurchases) return;
  
  try {
    await InAppPurchases.disconnectAsync();
    isListenerSetup = false;
    purchaseResolvers = [];
  } catch (error) {
    console.error('Error disconnecting purchases:', error);
  }
}

/**
 * Get the purchase status from storage
 */
export async function getPurchaseStatus(): Promise<PurchaseStatus> {
  try {
    const data = await AsyncStorage.getItem(PURCHASE_STATUS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return { hasPurchased: false };
  } catch (error) {
    console.error('Error getting purchase status:', error);
    return { hasPurchased: false };
  }
}

/**
 * Save purchase status to storage
 */
async function savePurchaseStatus(status: PurchaseStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(PURCHASE_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('Error saving purchase status:', error);
  }
}

/**
 * Get available products (for future use if needed)
 */
export async function getProducts(): Promise<any[]> {
  if (!InAppPurchases) return [];
  
  try {
    const { results } = await InAppPurchases.getProductsAsync([PURCHASE_PRODUCT_ID]);
    return results || [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

/**
 * Purchase the full app unlock
 */
export async function purchaseFullApp(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Check if already purchased
    const status = await getPurchaseStatus();
    if (status.hasPurchased) {
      return { success: true };
    }

    // Initialize if not already connected
    await initializePurchases();

    // Set up purchase listener if not already set
    setupPurchaseListener();

    // Create a promise that will be resolved by the purchase listener
    return new Promise((resolve, reject) => {
      // Add resolver to the queue
      purchaseResolvers.push({ resolve, reject });

      // Initiate the purchase
      if (!InAppPurchases) {
        resolve({
          success: false,
          error: 'In-app purchases not available (Expo Go or development mode)',
        });
        return;
      }
      
      InAppPurchases.purchaseItemAsync(PURCHASE_PRODUCT_ID).catch((error) => {
        // Remove this resolver from the queue
        purchaseResolvers = purchaseResolvers.filter((r) => r.resolve !== resolve);
        resolve({
          success: false,
          error: error?.message || 'Failed to initiate purchase',
        });
      });
    });
  } catch (error: any) {
    console.error('Error purchasing:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error occurred',
    };
  }
}

/**
 * Restore previous purchases (for when user reinstalls app or uses on new device)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  restored: boolean;
  error?: string;
}> {
  if (!InAppPurchases) {
    return {
      success: false,
      restored: false,
      error: 'In-app purchases not available (Expo Go or development mode)',
    };
  }
  
  try {
    await initializePurchases();

    // Check current purchase status first
    const currentStatus = await getPurchaseStatus();
    if (currentStatus.hasPurchased) {
      return { success: true, restored: false };
    }

    // Get purchase history
    const { results } = await InAppPurchases.getPurchaseHistoryAsync();
    
    if (results && results.length > 0) {
      // Check if any purchase matches our product ID
      const validPurchase = results.find(
        (purchase) => purchase.productId === PURCHASE_PRODUCT_ID
      );

      if (validPurchase) {
        await savePurchaseStatus({
          hasPurchased: true,
          purchaseDate: validPurchase.purchaseTime || Date.now(),
          transactionId: validPurchase.orderId || validPurchase.transactionReceipt,
        });
        return { success: true, restored: true };
      }
    }

    return { success: true, restored: false };
  } catch (error: any) {
    console.error('Error restoring purchases:', error);
    return {
      success: false,
      restored: false,
      error: error?.message || 'Unknown error occurred',
    };
  }
}

/**
 * Check if user has purchased the full app
 */
export async function hasPurchasedFullApp(): Promise<boolean> {
  const status = await getPurchaseStatus();
  return status.hasPurchased;
}
