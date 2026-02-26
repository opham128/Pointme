import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Category } from '../types';
import { CATEGORIES } from '../constants';
import { SORA } from '../constants/fonts';

interface CategoryButtonProps {
  category: Category;
  onPress: (category: Category) => void;
}

const ACCENT_COLOR = '#007AFF';
const RANDOM_GRADIENT_START = '#007AFF';
const RANDOM_GRADIENT_END = '#5856D6';

export function CategoryButton({ category, onPress }: CategoryButtonProps) {
  const isDark = true; // Always dark mode
  const categoryInfo = CATEGORIES[category];
  const isRandom = category === 'random';
  
  // Animation for press
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const handlePress = () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Scale animation
    scale.value = withSequence(
      withSpring(0.97, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );
    
    // Glow animation for Random
    if (isRandom) {
      glow.value = withSequence(
        withSpring(1, { damping: 10 }),
        withSpring(0, { damping: 10 })
      );
    }
    
    onPress(category);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    if (!isRandom) return {};
    return {
      shadowOpacity: 0.3 + glow.value * 0.3,
      shadowRadius: 8 + glow.value * 8,
    };
  });

  // Random button with accent color but same size
  if (isRandom) {
    return (
      <Animated.View style={[animatedStyle, glowStyle]}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: '#232325',
              borderColor: ACCENT_COLOR,
              borderWidth: 2,
            },
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.content}>
            <Text style={styles.emoji}>{categoryInfo.emoji}</Text>
            <Text
              style={[
                styles.label,
                { color: '#FFFFFF' },
              ]}
            >
              {categoryInfo.label}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Regular button styling
  return (
    <Animated.View style={animatedStyle}>
    <TouchableOpacity
      style={[
        styles.button,
        {
            backgroundColor: isDark ? '#232325' : '#F8F8F8',
            borderColor: '#3A3A3C',
        },
      ]}
        onPress={handlePress}
        activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Text style={styles.emoji}>{categoryInfo.emoji}</Text>
        <Text
          style={[
            styles.label,
            { color: isDark ? '#FFFFFF' : '#000000' },
          ]}
        >
          {categoryInfo.label}
        </Text>
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
    marginRight: 14,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
  },
});
