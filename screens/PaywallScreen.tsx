import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { purchaseFullApp, restorePurchases, initializePurchases } from '../services/purchases';
import { PURCHASE_PRICE } from '../constants';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

export default function PaywallScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { arrivalCount, refreshPurchaseStatus } = useAppContext();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Animation values
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(1); // Start at 1 to prevent blackout

  useEffect(() => {
      // Show content immediately (even if purchases not available)
    scale.value = withSequence(
      withSpring(1.02, { damping: 8 }),
      withSpring(1, { damping: 10 })
    );
    // Opacity already at 1, no need to animate it
    
    // Initialize purchases
    initializePurchases().then((available) => {
      setIsInitialized(available);
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePurchase = async () => {
    if (!isInitialized) {
      setError('Purchases are not available. Please try again later.');
      return;
    }

    setIsPurchasing(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await purchaseFullApp();
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshPurchaseStatus?.();
        router.back();
      } else {
        if (result.error !== 'Purchase cancelled') {
          setError(result.error || 'Purchase failed. Please try again.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await restorePurchases();
      if (result.success && result.restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshPurchaseStatus?.();
        router.back();
      } else if (result.success && !result.restored) {
        setError('No previous purchases found to restore.');
      } else {
        setError(result.error || 'Failed to restore purchases.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while restoring.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.closeButtonText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
            ✕
          </Text>
        </TouchableOpacity>

        <Text style={[styles.emoji, { color: isDark ? '#FFFFFF' : '#000000' }]}>🔒</Text>

        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Unlock Lifetime Access
        </Text>

        <Text style={[styles.subtitle, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
          You've reached your free limit of {arrivalCount} locations
        </Text>

        <Text style={[styles.beerText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Support the Dev team for less than the price of a beer! 🍺
        </Text>

        <View style={[styles.featuresContainer, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
              <Text style={[styles.featureIconText, { color: isDark ? '#FFFFFF' : '#000000' }]}>∞</Text>
            </View>
            <Text style={[styles.featureText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              Unlimited locations
            </Text>
          </View>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
              <Text style={[styles.featureIconText, { color: isDark ? '#FFFFFF' : '#000000' }]}>★</Text>
            </View>
            <Text style={[styles.featureText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              All destination types
            </Text>
          </View>
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: isDark ? '#2C1C1C' : '#FFE5E5' }]}>
            <Text style={[styles.errorText, { color: isDark ? '#FF6B6B' : '#D32F2F' }]}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              { backgroundColor: '#007AFF' },
              (isPurchasing || !isInitialized) && styles.buttonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing || !isInitialized}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                Purchase for ${PURCHASE_PRICE.toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.restoreButton,
              { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' },
              isRestoring && styles.buttonDisabled,
            ]}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color={isDark ? '#FFFFFF' : '#000000'} />
            ) : (
              <Text style={[styles.restoreButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                Restore Purchase
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
          Payment will be charged to your {Platform.OS === 'ios' ? 'Apple' : 'Google'} account
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  emoji: {
    fontSize: 64,
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  beerText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  featuresContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 80,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureIconText: {
    fontSize: 18,
    fontWeight: '500',
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
  },
  errorContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  purchaseButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  restoreButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

