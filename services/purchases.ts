import AsyncStorage from '@react-native-async-storage/async-storage';

const PURCHASE_STATUS_KEY = '@pointme:purchase_status';
const PURCHASE_PRODUCT_ID = 'com.pointme.paywall'; // your current ID

let IAP: typeof import('expo-iap') | null = null;

try {
  IAP = require('expo-iap');
} catch (error) {
  console.warn('expo-iap not available - running in Expo Go or development mode');
}

export interface PurchaseStatus {
  hasPurchased: boolean;
  purchaseDate?: number;
  transactionId?: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function getPurchaseStatus(): Promise<PurchaseStatus> {
  try {
    const data = await AsyncStorage.getItem(PURCHASE_STATUS_KEY);
    if (data) return JSON.parse(data);
    return { hasPurchased: false };
  } catch (error) {
    console.error('❌ Error getting purchase status:', error);
    return { hasPurchased: false };
  }
}

async function savePurchaseStatus(status: PurchaseStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(PURCHASE_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('❌ Error saving purchase status:', error);
  }
}

export async function hasPurchasedFullApp(): Promise<boolean> {
  const status = await getPurchaseStatus();
  return status.hasPurchased;
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export async function initializePurchases(): Promise<boolean> {
  if (!IAP) {
    console.warn('⚠️ expo-iap not available');
    return false;
  }

  try {
    console.log('🔌 Initializing IAP...');
    await IAP.initConnection();

    // OPTIONAL: Uncomment for deeper debugging
    /*
    IAP.setPurchaseListener(async (result) => {
      console.log('📥 Purchase listener result:', result);

      if (result.responseCode === IAP.IAPResponseCode.OK) {
        const purchase = result.results?.[0];
        if (purchase) {
          console.log('✅ Finishing transaction from listener');
          await IAP.finishTransaction({
            purchase,
            isConsumable: false,
          });
        }
      }
    });
    */

    return true;
  } catch (error) {
    console.error('❌ Error initializing purchases:', error);
    return false;
  }
}

export async function disconnectPurchases(): Promise<void> {
  if (!IAP) return;
  try {
    await IAP.endConnection();
  } catch (error) {
    console.error('❌ Error disconnecting purchases:', error);
  }
}

// ─── Get products ─────────────────────────────────────────────────────────────

export async function getProducts(): Promise<any[]> {
  if (!IAP) return [];

  try {
    console.log('🛒 Fetching products for:', PURCHASE_PRODUCT_ID);

    const products = await IAP.fetchProducts({
      skus: [PURCHASE_PRODUCT_ID],
    });

    console.log('📦 Products returned:', JSON.stringify(products, null, 2));

    if (!products || products.length === 0) {
      console.warn('⚠️ No products found → App Store config issue');
    }

    return products || [];
  } catch (error) {
    console.error('❌ Error getting products:', error);
    return [];
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function purchaseFullApp(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!IAP) {
    return {
      success: false,
      error: 'In-app purchases not available',
    };
  }

  try {
    const status = await getPurchaseStatus();
    if (status.hasPurchased) {
      console.log('✅ Already purchased');
      return { success: true };
    }

    await initializePurchases();

    console.log('💳 Attempting purchase for:', PURCHASE_PRODUCT_ID);

    const purchase = await IAP.requestPurchase({
      request: {
        apple: { sku: PURCHASE_PRODUCT_ID },
        google: { skus: [PURCHASE_PRODUCT_ID] },
      },
      type: 'in-app',
    });

    console.log('📥 Raw purchase response:', purchase);

    if (!purchase) {
      return { success: false, error: 'Purchase failed. Please try again.' };
    }

    const singlePurchase = Array.isArray(purchase) ? purchase[0] : purchase;

    console.log('📦 Parsed purchase:', singlePurchase);

    console.log('✅ Finishing transaction...');
    await IAP.finishTransaction({
      purchase: singlePurchase,
      isConsumable: false,
    });

    await savePurchaseStatus({
      hasPurchased: true,
      purchaseDate: Date.now(),
      transactionId:
        (singlePurchase as any).transactionId ||
        (singlePurchase as any).orderId ||
        (singlePurchase as any).transactionReceipt ||
        'unknown',
    });

    console.log('🎉 Purchase successful and saved locally');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Error purchasing:', error);

    if (
      error?.code === 'E_USER_CANCELLED' ||
      error?.message?.toLowerCase().includes('cancel')
    ) {
      console.log('🚫 User cancelled purchase');
      return { success: false, error: 'Purchase cancelled' };
    }

    return {
      success: false,
      error: error?.message || 'Unknown error occurred',
    };
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export async function restorePurchases(): Promise<{
  success: boolean;
  restored: boolean;
  error?: string;
}> {
  if (!IAP) {
    return {
      success: false,
      restored: false,
      error: 'In-app purchases not available',
    };
  }

  try {
    await initializePurchases();

    const currentStatus = await getPurchaseStatus();
    if (currentStatus.hasPurchased) {
      console.log('✅ Already restored locally');
      return { success: true, restored: true };
    }

    console.log('🔄 Fetching available purchases...');
    const purchases = await IAP.getAvailablePurchases();

    console.log('📦 Available purchases:', JSON.stringify(purchases, null, 2));

    if (purchases && purchases.length > 0) {
      const valid = purchases.find(
        (p: any) => p.productId === PURCHASE_PRODUCT_ID
      );

      if (valid) {
        console.log('✅ Found valid purchase to restore');

        await savePurchaseStatus({
          hasPurchased: true,
          purchaseDate: (valid as any).transactionDate || Date.now(),
          transactionId:
            (valid as any).transactionId ||
            (valid as any).orderId ||
            'restored',
        });

        return { success: true, restored: true };
      }
    }

    console.warn('⚠️ No purchases found to restore');
    return { success: true, restored: false };
  } catch (error: any) {
    console.error('❌ Error restoring purchases:', error);
    return {
      success: false,
      restored: false,
      error: error?.message || 'Unknown error occurred',
    };
  }
}

// ─── Debug helpers (dev only) ─────────────────────────────────────────────────

export async function togglePurchaseStatusDebug(): Promise<boolean> {
  if (!__DEV__) {
    throw new Error('This function is only available in development mode');
  }
  const currentStatus = await getPurchaseStatus();
  const newStatus: PurchaseStatus = {
    hasPurchased: !currentStatus.hasPurchased,
    purchaseDate: !currentStatus.hasPurchased ? Date.now() : undefined,
    transactionId: !currentStatus.hasPurchased ? 'debug-transaction-id' : undefined,
  };
  await savePurchaseStatus(newStatus);
  return newStatus.hasPurchased;
}

export async function setPurchaseStatusDebug(hasPurchased: boolean): Promise<void> {
  if (!__DEV__) {
    throw new Error('This function is only available in development mode');
  }
  await savePurchaseStatus({
    hasPurchased,
    purchaseDate: hasPurchased ? Date.now() : undefined,
    transactionId: hasPurchased ? 'debug-transaction-id' : undefined,
  });
}
