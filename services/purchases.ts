import AsyncStorage from '@react-native-async-storage/async-storage';

const PURCHASE_STATUS_KEY = '@pointme:purchase_status';
const PURCHASE_PRODUCT_ID = '11';

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
    console.error('Error getting purchase status:', error);
    return { hasPurchased: false };
  }
}

async function savePurchaseStatus(status: PurchaseStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(PURCHASE_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('Error saving purchase status:', error);
  }
}

export async function hasPurchasedFullApp(): Promise<boolean> {
  const status = await getPurchaseStatus();
  return status.hasPurchased;
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export async function initializePurchases(): Promise<boolean> {
  if (!IAP) {
    console.warn('expo-iap not available');
    return false;
  }

  try {
    await IAP.initConnection();
    return true;
  } catch (error) {
    console.error('Error initializing purchases:', error);
    return false;
  }
}

export async function disconnectPurchases(): Promise<void> {
  if (!IAP) return;
  try {
    await IAP.endConnection();
  } catch (error) {
    console.error('Error disconnecting purchases:', error);
  }
}

// ─── Get products ─────────────────────────────────────────────────────────────

export async function getProducts(): Promise<any[]> {
  if (!IAP) return [];

  try {
    const products = await IAP.fetchProducts({ skus: [PURCHASE_PRODUCT_ID] });
    return products || [];
  } catch (error) {
    console.error('Error getting products:', error);
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
    // Already purchased — no need to buy again
    const status = await getPurchaseStatus();
    if (status.hasPurchased) return { success: true };

    await initializePurchases();

    const purchase = await IAP.requestPurchase({
      request: {
        apple: { sku: PURCHASE_PRODUCT_ID },
        google: { skus: [PURCHASE_PRODUCT_ID] },
      },
      type: 'in-app',
    });

    if (!purchase) {
      return { success: false, error: 'Purchase failed. Please try again.' };
    }

    // Finish the transaction — expo-iap expects a single Purchase not an array
    const singlePurchase = Array.isArray(purchase) ? purchase[0] : purchase;
    await IAP.finishTransaction({ purchase: singlePurchase, isConsumable: false });

    // Save locally
    await savePurchaseStatus({
      hasPurchased: true,
      purchaseDate: Date.now(),
      transactionId:
        (singlePurchase as any).transactionId ||
        (singlePurchase as any).orderId ||
        (singlePurchase as any).transactionReceipt ||
        'unknown',
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error purchasing:', error);

    // User cancelled — don't show error
    if (
      error?.code === 'E_USER_CANCELLED' ||
      error?.message?.toLowerCase().includes('cancel')
    ) {
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

    // Already stored locally
    const currentStatus = await getPurchaseStatus();
    if (currentStatus.hasPurchased) return { success: true, restored: true };

    const purchases = await IAP.getAvailablePurchases();

    if (purchases && purchases.length > 0) {
      const valid = purchases.find(
        (p: any) => p.productId === PURCHASE_PRODUCT_ID
      );

      if (valid) {
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