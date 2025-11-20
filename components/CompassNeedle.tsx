import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface CompassNeedleProps {
  /**
   * Rotation angle in degrees
   * This is the difference between target bearing and user heading
   * When this is 0, the needle points North
   */
  rotation: number;
}

export function CompassNeedle({ rotation }: CompassNeedleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Use shared value for smooth animation
  const rotationValue = useSharedValue(rotation);

  // Update rotation value when prop changes
  React.useEffect(() => {
    rotationValue.value = withSpring(rotation, {
      damping: 15,
      stiffness: 100,
    });
  }, [rotation]);

  // Animated style for the needle rotation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotationValue.value}deg` }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Compass background circle */}
      <View
        style={[
          styles.compassCircle,
          {
            borderColor: isDark ? '#3A3A3C' : '#E5E5EA',
            backgroundColor: isDark ? '#1C1C1E' : '#F9F9F9',
          },
        ]}
      >
        {/* North indicator */}
        <View style={[styles.northIndicator, { backgroundColor: isDark ? '#FF3B30' : '#FF3B30' }]} />
        
        {/* Compass needle */}
        <Animated.View style={[styles.needleContainer, animatedStyle]}>
          <View style={[styles.needle, { backgroundColor: isDark ? '#FF3B30' : '#FF3B30' }]} />
          <View style={[styles.needleTail, { backgroundColor: isDark ? '#8E8E93' : '#8E8E93' }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  northIndicator: {
    position: 'absolute',
    top: 10,
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  needleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  needle: {
    width: 4,
    height: 100,
    borderRadius: 2,
    position: 'absolute',
    top: '50%',
    marginTop: -100,
  },
  needleTail: {
    width: 4,
    height: 100,
    borderRadius: 2,
    position: 'absolute',
    bottom: '50%',
    marginBottom: -100,
  },
});

