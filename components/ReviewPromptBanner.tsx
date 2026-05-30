import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SORA } from '../constants/fonts';

interface ReviewPromptBannerProps {
  visible: boolean;
  onDismiss: () => void;
  onReview: () => void;
}

export function ReviewPromptBanner({ visible, onDismiss, onReview }: ReviewPromptBannerProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(12, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { marginBottom: Math.max(insets.bottom, 8) },
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.message}>
          Enjoying Point Me? A quick review helps a lot.
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={onReview}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Leave a review"
          >
            <Text style={styles.reviewButtonText}>Sure</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 4,
  },
  content: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: SORA.Regular,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  dismissText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 14,
    fontFamily: SORA.Medium,
  },
  reviewButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.18)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  reviewButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontFamily: SORA.SemiBold,
  },
});
