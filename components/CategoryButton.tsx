import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { Category } from '../types';
import { CATEGORIES } from '../constants';

interface CategoryButtonProps {
  category: Category;
  onPress: (category: Category) => void;
}

export function CategoryButton({ category, onPress }: CategoryButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const categoryInfo = CATEGORIES[category];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
          borderColor: isDark ? '#3A3A3C' : '#E5E5EA',
        },
      ]}
      onPress={() => onPress(category)}
      activeOpacity={0.7}
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
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
    marginRight: 12,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
  },
});

