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
  const [showConfetti, setShowConfetti] = React.useState(false);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (trigger > 0) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  if (!showConfetti) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <ConfettiCannon
        count={200}
        origin={{ x: width / 2, y: height / 2 }}
        fadeOut
        autoStart
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

