import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  const isDark = true; // Always dark mode
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
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.closeButtonText, { color: '#8E8E93' }]}>
            ✕
          </Text>
        </TouchableOpacity>

        <Text style={[styles.emoji, { color: '#FFFFFF' }]}>🧭</Text>

        <Text style={[styles.title, { color: '#FFFFFF' }]}>
        Unlock Your Next Adventure
        </Text>

        <Text style={[styles.subtitle, { color: '#8E8E93' }]}>
          You've reached your free limit of 5 locations
        </Text>

        <Text style={[styles.beerText, { color: '#FFFFFF' }]}>
          Support the Dev team for less than the price of a beer! 🍺
        </Text>

        <View style={[styles.featuresContainer, { backgroundColor: '#1C1C1E' }]}>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(0, 122, 255, 0.2)' }]}>
              <Text style={[styles.featureIconText, { color: '#007AFF' }]}>∞</Text>
            </View>
            <Text style={[styles.featureText, { color: '#FFFFFF' }]}>
              Unlimited searches and fun plans
            </Text>
          </View>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(255, 204, 0, 0.2)' }]}>
              <Text style={[styles.featureIconText, { color: '#FFCC00' }]}>★</Text>
            </View>
            <Text style={[styles.featureText, { color: '#FFFFFF' }]}>
            Bars, dates, food all in one
            </Text>
          </View>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(175, 82, 222, 0.2)' }]}>
              <Text style={[styles.featureIconText, { color: '#AF52DE' }]}>◆</Text>
            </View>
            <Text style={[styles.featureText, { color: '#FFFFFF' }]}>
              Pick the cuisine & price
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
              isPurchasing && styles.buttonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing}
            activeOpacity={1}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                Lifetime Access for ${PURCHASE_PRICE.toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.lifetimeText, { color: '#8E8E93' }]}>
            One-time purchase • No subscription, ever
          </Text>
        </View>

        <TouchableOpacity
          style={styles.restoreButtonTextOnly}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator color={isDark ? '#636366' : '#8E8E93'} size="small" />
          ) : (
            <Text style={[styles.restoreButtonTextOnlyText, { color: isDark ? '#636366' : '#8E8E93' }]}>
              Restore Purchase
            </Text>
          )}
        </TouchableOpacity>

        {/* <Text style={[styles.footerText, { color: '#8E8E93' }]}>
          Payment will be charged to your {Platform.OS === 'ios' ? 'Apple' : 'Google'} account
        </Text> */}
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
    opacity: 0.6,
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
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  beerText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  featuresContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 10,
    marginBottom: 60,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    gap: 6,
    marginTop: 12,
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    opacity: 1,
  },
  restoreButton: {
    paddingVertical: 4,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButtonTextOnly: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    alignItems: 'center',
    marginBottom: 0,
  },
  restoreButtonTextOnlyText: {
    fontSize: 14,
    fontWeight: '400',
  },
  lifetimeText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // footerText: {
  //   fontSize: 11,
  //   textAlign: 'center',
  //   paddingHorizontal: 20,
  //   lineHeight: 14,
  // },
});

