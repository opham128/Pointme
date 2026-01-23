import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  SharedValue,
} from 'react-native-reanimated';

interface CompassNeedleProps {
  /**
   * Rotation angle in degrees
   * This is the difference between target bearing and user heading
   * When this is 0, the needle points North
   */
  rotation: number;
  /**
   * Pulse scale animation value (for when close to destination)
   */
  pulseScale?: SharedValue<number>;
  /**
   * Pulse opacity animation value (for when close to destination)
   */
  pulseOpacity?: SharedValue<number>;
}

/**
 * Normalizes angle to shortest path between current and target
 * Handles 0-360 wrap-around smoothly
 */
function normalizeAngle(current: number, target: number): number {
  // Normalize to -180 to 180 range
  let diff = target - current;
  
  // Find shortest path (handle wrap-around)
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  return current + diff;
}

export function CompassNeedle({ rotation, pulseScale, pulseOpacity }: CompassNeedleProps) {
  const isDark = true; // Always dark mode
  
  // Use shared value for smooth animation
  const rotationValue = useSharedValue(rotation);
  
  // Default pulse values if not provided
  const defaultPulseScale = useSharedValue(1);
  const defaultPulseOpacity = useSharedValue(0.3);
  const activePulseScale = pulseScale || defaultPulseScale;
  const activePulseOpacity = pulseOpacity || defaultPulseOpacity;

  // Update rotation value when prop changes
  React.useEffect(() => {
    // Normalize the rotation to take the shortest path
    const normalizedTarget = normalizeAngle(rotationValue.value, rotation);
    
    // Use withTiming with smooth easing instead of spring for Apple-like smoothness
    rotationValue.value = withTiming(normalizedTarget, {
      duration: 200, // Smooth, responsive animation
      easing: Easing.out(Easing.cubic), // Smooth easing curve similar to Apple's
    });
  }, [rotation]);

  // Animated style for the needle rotation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotationValue.value}deg` }],
    };
  });
  
  // Animated style for pulsing glow
  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: activePulseScale.value }],
      opacity: activePulseOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* Compass background circle with gradient effect */}
      <View
        style={[
          styles.compassCircle,
          {
            borderColor: '#3A3A3C',
            backgroundColor: '#1C1C1E',
          },
        ]}
      >
        {/* Pulsing glow ring (when close) */}
        <Animated.View style={[styles.glowRing, pulseAnimatedStyle]} />
        
        {/* Outer glow ring (static) */}
        <View style={styles.glowRingStatic} />
        
        {/* North indicator */}
        <View style={[styles.northIndicator, { backgroundColor: '#FF3B30' }]} />
        
        {/* Center dot */}
        <View style={styles.centerDot} />
        
        {/* Compass needle with enhanced design */}
        <Animated.View style={[styles.needleContainer, animatedStyle]}>
          <View style={[styles.needle, { backgroundColor: '#FF3B30' }]} />
          <View style={[styles.needleTail, { backgroundColor: '#8E8E93' }]} />
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
    shadowColor: '#FF3B30',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  glowRing: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.6)',
  },
  glowRingStatic: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  northIndicator: {
    position: 'absolute',
    top: 10,
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#1C1C1E',
    zIndex: 10,
    shadowColor: '#FF3B30',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  needleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  needle: {
    width: 5,
    height: 100,
    borderRadius: 2.5,
    position: 'absolute',
    top: '50%',
    marginTop: -100,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  needleTail: {
    width: 4,
    height: 100,
    borderRadius: 2,
    position: 'absolute',
    bottom: '50%',
    marginBottom: -100,
    backgroundColor: '#8E8E93',
    opacity: 0.7,
    shadowColor: '#8E8E93',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
});

