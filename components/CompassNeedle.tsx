import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
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
  /**
   * Called when the needle’s animated position crosses 0° (i.e. hits the bearing).
   * Use this to trigger haptics in sync with the visual needle.
   */
  onAligned?: () => void;
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

export function CompassNeedle({ rotation, pulseScale, pulseOpacity, onAligned }: CompassNeedleProps) {
  const isDark = true; // Always dark mode
  
  // Use shared value for smooth animation
  const rotationValue = useSharedValue(rotation);
  const prevRotation = useSharedValue(rotation);
  const hasInitialized = useSharedValue(false);

  // Default pulse values if not provided
  const defaultPulseScale = useSharedValue(1);
  const defaultPulseOpacity = useSharedValue(0.3);
  const activePulseScale = pulseScale || defaultPulseScale;
  const activePulseOpacity = pulseOpacity || defaultPulseOpacity;

  // Update rotation value when prop changes – use spring for smooth, natural needle motion
  React.useEffect(() => {
    const normalizedTarget = normalizeAngle(rotationValue.value, rotation);
    const diff = Math.abs(normalizedTarget - rotationValue.value);
    // Skip tiny updates to reduce jitter from sensor noise (smooth follow)
    if (diff < 0.4) return;

    rotationValue.value = withSpring(normalizedTarget, {
      damping: 22,
      stiffness: 90,
      mass: 0.8,
    });
  }, [rotation]);

  // Animated style for the needle rotation. Crossing check runs here so haptic fires
  // in the exact same frame as the visual update (no timing drift).
  const animatedStyle = useAnimatedStyle(() => {
    const current = rotationValue.value;
    if (!hasInitialized.value) {
      prevRotation.value = current;
      hasInitialized.value = true;
    } else {
      const prev = prevRotation.value;
      prevRotation.value = current;
      if (onAligned) {
        const signChange = (prev >= 0 && current < 0) || (prev < 0 && current >= 0);
        // Fast pass: we skipped the exact zero frame (e.g. went from -0.5° to -3° in one step)
        const sweptThroughZero =
          prev < 0 && current < 0 && current < prev && prev > -3;
        if (signChange || sweptThroughZero) {
          runOnJS(onAligned)();
        }
      }
    }
    return {
      transform: [{ rotateZ: `${current}deg` }],
    };
  }, [onAligned]);
  
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
        
        {/* North indicator */}
        <View style={[styles.northIndicator, { backgroundColor: '#FF3B30' }]} />
        
        {/* Compass tick marks - major ticks every 45 degrees */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = i * 45; // 360 / 8
          // Skip the tick at 0 degrees (same position as north indicator)
          if (angle === 0) return null;
          return (
            <View
              key={`major-tick-${i}`}
              style={[
                styles.tickMark,
                styles.majorTick,
                {
                  transform: [
                    { rotateZ: `${angle}deg` },
                    { translateY: -135 }, // distance from center (radius - padding)
                  ],
                },
              ]}
            />
          );
        })}
        
        {/* Compass tick marks - minor ticks every 9 degrees */}
        {Array.from({ length: 40 }).map((_, i) => {
          const angle = i * 9; // Every 9 degrees
          // Skip ticks at major positions (multiples of 45) and at 0 degrees (north indicator)
          if (angle % 45 === 0 || angle === 0) return null;
          return (
            <View
              key={`minor-tick-${i}`}
              style={[
                styles.tickMark,
                styles.minorTick,
                {
                  transform: [
                    { rotateZ: `${angle}deg` },
                    { translateY: -135 }, // distance from center (radius - padding)
                  ],
                },
              ]}
            />
          );
        })}
        
        {/* Center dot */}
        <View style={styles.centerDot} />
        
        {/* Compass needle with enhanced design - isosceles triangle shape */}
        <Animated.View style={[styles.needleContainer, animatedStyle]}>
          {/* Top triangle (red) */}
          <View style={styles.needleTopTriangle} />
          {/* Bottom triangle (gray) */}
          <View style={styles.needleBottomTriangle} />
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
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.6)',
  },
  northIndicator: {
    position: 'absolute',
    top: 6,
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  tickMark: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: '#8E8E93', // subtle gray
  },
  majorTick: {
    width: 1,
    height: 18,
    opacity: 0.6,
  },
  minorTick: {
    width: 1,
    height: 10,
    opacity: 0.4,
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
  needleTopTriangle: {
    position: 'absolute',
    top: '50%',
    marginTop: -100,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 100,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  needleBottomTriangle: {
    position: 'absolute',
    bottom: '50%',
    marginBottom: -100,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 100,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#8E8E93',
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

