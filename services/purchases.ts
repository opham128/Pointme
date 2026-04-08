import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseErrorListener,
  purchaseUpdatedListener,
  ErrorCode,
} from 'react-native-iap';

const PURCHASE_STATUS_KEY = '@pointme:purchase_status';
const PURCHASE_PRODUCT_ID = 'com.pointme.paywall';

export interface PurchaseStatus {
  hasPurchased: boolean;
  purchaseDate?: number;
  transactionId?: string;
}

// ─── Global state ─────────────────────────────────────────────

let isInitialized = false;
let purchaseUpdateSub: any = null;
let purchaseErrorSub: any = null;

// ─── Storage helpers ──────────────────────────────────────────

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

// ─── Initialize ───────────────────────────────────────────────

export async function initializePurchases(): Promise<boolean> {
  try {
    if (isInitialized) return true;

    console.log('🔌 Initializing IAP...');
    await initConnection();
    console.log('✅ IAP connected');

    isInitialized = true;

    // Setup listeners ONCE
    if (!purchaseUpdateSub) {
      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
        console.log('📥 Purchase update:', purchase);

        if (
          purchase.productId === PURCHASE_PRODUCT_ID ||
          purchase.id === PURCHASE_PRODUCT_ID
        ) {
          try {
            await finishTransaction({ purchase, isConsumable: false });

            await savePurchaseStatus({
              hasPurchased: true,
              purchaseDate: Date.now(),
              transactionId: purchase.transactionId || purchase.id || 'unknown',
            });

            console.log('🎉 Purchase successful');
          } catch (err: any) {
            console.error('❌ Error finishing transaction:', err);
          }
        }
      });

      purchaseErrorSub = purchaseErrorListener((error: any) => {
        console.error('❌ Purchase error:', error);
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Error initializing purchases:', error);
    return false;
  }
}

// ─── Disconnect ───────────────────────────────────────────────

export async function disconnectPurchases(): Promise<void> {
  try {
    purchaseUpdateSub?.remove();
    purchaseErrorSub?.remove();
    purchaseUpdateSub = null;
    purchaseErrorSub = null;

    await endConnection();
    isInitialized = false;
  } catch (error) {
    console.error('❌ Error disconnecting purchases:', error);
  }
}

// ─── Get products ─────────────────────────────────────────────

export async function getProductsList(): Promise<any[]> {
  try {
    await initializePurchases();

    console.log('🛒 Fetching products for:', PURCHASE_PRODUCT_ID);
    const products = await fetchProducts({
      skus: [PURCHASE_PRODUCT_ID],
      type: 'in-app',
    });

    console.log('📦 Products returned:', JSON.stringify(products, null, 2));

    if (!products || products.length === 0) {
      console.warn('⚠️ No products found → check App Store Connect config');
    }

    return products || [];
  } catch (error) {
    console.error('❌ Error getting products:', error);
    return [];
  }
}

export { getProductsList as getProducts };

// ─── Purchase ─────────────────────────────────────────────────

export async function purchaseFullApp(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const status = await getPurchaseStatus();
    if (status.hasPurchased) {
      console.log('✅ Already purchased');
      return { success: true };
    }

    await initializePurchases();

    console.log('💳 Attempting purchase for:', PURCHASE_PRODUCT_ID);

    await requestPurchase({
      request: {
        ios: { sku: PURCHASE_PRODUCT_ID },
      },
      type: 'in-app',
    });

    // success handled by listener
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error purchasing:', error);

    if (
      error?.code === ErrorCode.UserCancelled ||
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

// ─── Restore ──────────────────────────────────────────────────

export async function restorePurchases(): Promise<{
  success: boolean;
  restored: boolean;
  error?: string;
}> {
  try {
    await initializePurchases();

    const currentStatus = await getPurchaseStatus();
    if (currentStatus.hasPurchased) {
      console.log('✅ Already restored locally');
      return { success: true, restored: true };
    }

    console.log('🔄 Fetching available purchases...');
    const purchases = await getAvailablePurchases();

    console.log('📦 Available purchases:', JSON.stringify(purchases, null, 2));

    if (purchases && purchases.length > 0) {
      const valid = (purchases as any[]).find(
        (p) => p.productId === PURCHASE_PRODUCT_ID || p.id === PURCHASE_PRODUCT_ID
      );

      if (valid) {
        console.log('✅ Found valid purchase to restore');

        await savePurchaseStatus({
          hasPurchased: true,
          purchaseDate: valid.transactionDate
            ? Number(valid.transactionDate)
            : Date.now(),
          transactionId: valid.transactionId || valid.id || 'restored',
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

// ─── Debug helpers ────────────────────────────────────────────

export async function togglePurchaseStatusDebug(): Promise<boolean> {
  if (!__DEV__) {
    throw new Error('This function is only available in development mode');
  }

  const currentStatus = await getPurchaseStatus();

  const newStatus: PurchaseStatus = {
    hasPurchased: !currentStatus.hasPurchased,
    purchaseDate: !currentStatus.hasPurchased ? Date.now() : undefined,
    transactionId: !currentStatus.hasPurchased
      ? 'debug-transaction-id'
      : undefined,
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