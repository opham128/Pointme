import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

interface ConfettiAnimationProps {
  /**
   * Trigger confetti animation
   */
  trigger: number;
}

export function ConfettiAnimation({ trigger }: ConfettiAnimationProps) {
  const { width, height } = useWindowDimensions();

  // Render immediately when trigger > 0, no state delay
  if (trigger === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <ConfettiCannon
        key={trigger} // Force fresh instance on each trigger
        count={100}
        origin={{ x: width / 2, y: height / 2 }}
        fadeOut
        autoStart
        explosionSpeed={350}
        fallSpeed={2000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});

