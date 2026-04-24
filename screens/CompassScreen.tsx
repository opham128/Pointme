import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useAppContext } from '../context/AppContext';
import { useHeading } from '../hooks/useHeading';
import { useNearestPlace } from '../hooks/useNearestPlace';
import { useDistance } from '../hooks/useDistance';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { calculateBearing } from '../services/mapboxPlaces';
import { CompassNeedle } from '../components/CompassNeedle';
import { ARRIVAL_DISTANCE_THRESHOLD, FREE_LOCATIONS_LIMIT } from '../constants';
import { CATEGORIES } from '../constants';
import { getDistanceUnit, saveDistanceUnit, DistanceUnit } from '../services/storage';
import { registerCompassDevHandlers } from '../devTesting';
import { SORA } from '../constants/fonts';

// ─── Design tokens ─────────────────────────────────────────────────────────
const GOLD   = '#F5A623';
const CORAL  = '#FF4D6D';
const TEAL   = '#00E5CC';
const BG     = '#0A0A0A';
const CARD   = '#141414';
const BORDER = '#242424';
const MUTED  = '#555555';
const WHITE  = '#F0EDE6';

export default function CompassScreen() {
  const isDark = true;
  const router = useRouter();
  const { selectedCategory, userLocation, setTargetPlace, arrivalCount, hasPurchased, manualLocation } = useAppContext();
  const heading = useHeading(true);

  // Use manual location as fallback if GPS location is not available
  const effectiveLocation = userLocation || manualLocation;

  const { place, loading, error, refetch } = useNearestPlace(effectiveLocation, selectedCategory, !!effectiveLocation);
  const { distanceFeet, distanceMiles } = useDistance(effectiveLocation, place?.location || null);
  const isOnline = useNetworkStatus();
  const [hasArrived, setHasArrived] = useState(false);
  const [showLocationName, setShowLocationName] = useState(false);
  const hasAlignedRef = useRef(false);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('feet');
  const lastHapticTimeRef = useRef<number>(0);

  // Pulsing glow animation for when close
  const pulseScale   = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  // Expanding ring animation
  const ringScale    = useSharedValue(1);
  const ringOpacity  = useSharedValue(0);

  useEffect(() => {
    getDistanceUnit().then(setDistanceUnit);
  }, []);

  const [debugCloseDistance, setDebugCloseDistance] = useState<number | null>(null);

  const CLOSE_DISTANCE_THRESHOLD = 200; // feet
  const effectiveDistance = debugCloseDistance !== null ? debugCloseDistance : distanceFeet;

  useEffect(() => {
    if (!effectiveDistance || effectiveDistance > CLOSE_DISTANCE_THRESHOLD || hasArrived) {
      pulseScale.value   = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0.3, { duration: 200 });
      ringOpacity.value  = withTiming(0, { duration: 200 });
      return;
    }

    const distanceRatio  = 1 - (effectiveDistance / CLOSE_DISTANCE_THRESHOLD);
    const pulseIntensity = 0.3 + (distanceRatio * 0.4);
    const pulseSpeed     = 800 - (distanceRatio * 400);

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: pulseSpeed / 2, easing: Easing.out(Easing.ease) }),
        withTiming(1,    { duration: pulseSpeed / 2, easing: Easing.in(Easing.ease) }),
      ), -1, false
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(pulseIntensity, { duration: pulseSpeed / 2, easing: Easing.out(Easing.ease) }),
        withTiming(0.3,            { duration: pulseSpeed / 2, easing: Easing.in(Easing.ease) }),
      ), -1, false
    );

    // Expanding ring
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 0 }),
        withTiming(2.4, { duration: pulseSpeed, easing: Easing.out(Easing.ease) }),
      ), -1, false
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0,   { duration: pulseSpeed }),
      ), -1, false
    );

    // Heartbeat-style haptic (lub-dub) every ~1.5s while close
    const playHeartbeat = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 120);
    };
    playHeartbeat();
    lastHapticTimeRef.current = Date.now();
    const hapticInterval = setInterval(playHeartbeat, 1500);
    return () => clearInterval(hapticInterval);
  }, [effectiveDistance, hasArrived]);

  useEffect(() => {
    if (place) setTargetPlace(place);
  }, [place, setTargetPlace]);

  useEffect(() => {
    if (distanceFeet !== null && distanceFeet < ARRIVAL_DISTANCE_THRESHOLD && !hasArrived) {
      setHasArrived(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.push('/arrival'), 500);
    }
  }, [distanceFeet, hasArrived, router]);

  useEffect(() => {
    if (!selectedCategory) router.replace('/');
  }, [selectedCategory, router]);

  useEffect(() => {
    return registerCompassDevHandlers({
      testArrival: () => {
        setHasArrived(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => router.push('/arrival'), 500);
      },
      testPulse: (feet) => setDebugCloseDistance(feet),
    });
  }, [router]);

  const bearing = useMemo(() => {
    if (!effectiveLocation || !place) return 0;
    return calculateBearing(effectiveLocation, place.location);
  }, [effectiveLocation?.latitude, effectiveLocation?.longitude, place?.location.latitude, place?.location.longitude]);

  const rotation = useMemo(() => {
    if (!place) return 0;
    let diff = bearing - heading;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    return diff;
  }, [bearing, heading, place]);

  const handleNeedleAligned = React.useCallback(() => {
    if (!hasAlignedRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      hasAlignedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!place || hasArrived) return;
    if (Math.abs(rotation) > 2) hasAlignedRef.current = false;
  }, [rotation, place, hasArrived]);

  const displayData = useMemo(() => {
    if (distanceFeet === null || distanceFeet === undefined) return { rawNumber: 0, unit: '--' };

    if (distanceUnit === 'meters') {
      const distanceMeters = distanceFeet * 0.3048;
      if (distanceMeters < 1000) {
        return { rawNumber: distanceMeters, unit: 'm' };
      } else {
        const distanceKm = distanceMeters / 1000;
        return { rawNumber: distanceKm, unit: 'km' };
      }
    }

    if (distanceFeet < 5280) {
      return { rawNumber: distanceFeet, unit: 'ft' };
    }

    return { rawNumber: distanceMiles || (distanceFeet / 5280), unit: 'mi' };
  }, [distanceFeet, distanceMiles, distanceUnit]);

  const formatDistance = (value: number, unit: string) => {
    if (unit === 'm') return `${Math.round(value)}m`;
    if (unit === 'km') return `${value.toFixed(2)}km`;
    if (unit === 'ft') return `${Math.round(value)}ft`;
    if (unit === 'mi') return `${value.toFixed(2)}mi`;
    return '--';
  };

  const [animatedDistance, setAnimatedDistance] = useState<string>(() => {
    return displayData.unit === '--' ? '--' : formatDistance(displayData.rawNumber, displayData.unit);
  });
  const animationFrameRef = useRef<number | null>(null);
  const previousRawValueRef = useRef<number>(displayData.rawNumber);
  const previousUnitRef = useRef<string>(displayData.unit);

  useEffect(() => {
    if (displayData.unit === '--') {
      setAnimatedDistance('--');
      previousRawValueRef.current = 0;
      previousUnitRef.current = '--';
      return;
    }

    const startValue = previousUnitRef.current === displayData.unit
      ? previousRawValueRef.current
      : displayData.rawNumber;
    const endValue = displayData.rawNumber;
    const duration = 300;
    const startTime = Date.now();

    const step = () => {
      const now = Date.now();
      const elapsed = Math.min(duration, now - startTime);
      const progress = elapsed / duration;
      const currentValue = startValue + (endValue - startValue) * progress;
      setAnimatedDistance(formatDistance(currentValue, displayData.unit));

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        previousRawValueRef.current = endValue;
        previousUnitRef.current = displayData.unit;
      }
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [displayData.rawNumber, displayData.unit]);

  const handleToggleUnit = async () => {
    const newUnit: DistanceUnit = distanceUnit === 'feet' ? 'meters' : 'feet';
    setDistanceUnit(newUnit);
    await saveDistanceUnit(newUnit);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleLocationName = () => {
    setShowLocationName(!showLocationName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Animated styles
  const ringAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const isClose = !!effectiveDistance && effectiveDistance <= CLOSE_DISTANCE_THRESHOLD && !hasArrived;

  if (!selectedCategory) return null;

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading && !place) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.loadingText}>
          Sniffing out a {CATEGORIES[selectedCategory].label.toLowerCase()}…
        </Text>
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────
  if (error || !place) {
    if (loading) {
      return (
        <View style={styles.centerScreen}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>
            Sniffing out a {CATEGORIES[selectedCategory].label.toLowerCase()}…
          </Text>
        </View>
      );
    }

    const isOfflineError = error?.message?.toLowerCase().includes('internet') ||
                           error?.message?.toLowerCase().includes('network') || !isOnline;

    return (
      <View style={styles.centerScreen}>
        <Text style={styles.bigEmoji}>{isOfflineError ? '📶' : '🔍'}</Text>
        <Text style={styles.errorTitle}>{isOfflineError ? 'No Signal' : 'Nothing Found'}</Text>
        <Text style={styles.errorBody}>
          {isOfflineError
            ? 'Check your connection and try again.'
            : error?.message || 'No nearby places for this category.'}
        </Text>
        <View style={styles.buttonRow}>
          {isOfflineError && (
            <TouchableOpacity style={styles.ctaButton} onPress={() => refetch()}>
              <Text style={styles.ctaButtonText}>RETRY</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ghostButton} onPress={() => router.back()}>
            <Text style={styles.ghostButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main UI ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Compass zone ─────────────────────────────────────────────────── */}
      <View style={styles.compassZone}>
        {/* Expanding ring when close */}
        {isClose && (
          <Animated.View style={[styles.closeRing, ringAnimStyle]} />
        )}

        {/* Compass ring */}
        <View style={styles.compassRing}>
          <CompassNeedle
            rotation={rotation}
            pulseScale={pulseScale}
            pulseOpacity={pulseOpacity}
            onAligned={!hasArrived ? handleNeedleAligned : undefined}
          />
        </View>
      </View>

      {/* ── Info panel ───────────────────────────────────────────────────── */}
      <View style={styles.infoPanel}>
        {/* Distance */}
        <Text style={styles.distanceValue}>
          {animatedDistance}
        </Text>

        {/* Tap to reveal location name */}
        <TouchableOpacity onPress={handleToggleLocationName} activeOpacity={0.7} style={styles.revealRow}>
          {showLocationName ? (
            <Text style={styles.placeName}>{place.name}</Text>
          ) : (
            <View style={styles.redactedBlock}>
              <Text style={styles.redactedText}>████████████</Text>
              <Text style={styles.redactedHint}>tap to reveal</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Bearing / heading / unit strip */}
        <View style={styles.dataStrip}>
          <View style={styles.dataCell}>
            <Text style={styles.dataLabel}>HEADING</Text>
            <Text style={styles.dataValue}>{Math.round(heading)}°</Text>
          </View>
          <View style={styles.dataDivider} />
          <View style={styles.dataCell}>
            <Text style={styles.dataLabel}>BEARING</Text>
            <Text style={styles.dataValue}>{Math.round(bearing)}°</Text>
          </View>
          <View style={styles.dataDivider} />
          <View style={styles.dataCell}>
            <Text style={styles.dataLabel}>UNIT</Text>
            <TouchableOpacity onPress={handleToggleUnit}>
              <Text style={[styles.dataValue, { color: GOLD }]}>
                {distanceUnit === 'feet' ? 'FT' : 'M'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Back button ──────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← CHANGE CATEGORY</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  centerScreen: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // ── Loading / Error ───────────────────────────────────────────────────────────
  bigEmoji: { fontSize: 52, marginBottom: 16 },
  loadingText: {
    color: MUTED,
    fontFamily: SORA.Regular,
    fontSize: 14,
    letterSpacing: 1,
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    color: WHITE,
    fontFamily: SORA.Bold,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    color: MUTED,
    fontFamily: SORA.Regular,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  ctaButton: {
    backgroundColor: CORAL,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonText: {
    color: WHITE,
    fontFamily: SORA.Bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  ghostButton: { paddingVertical: 14, paddingHorizontal: 20 },
  ghostButtonText: { color: MUTED, fontFamily: SORA.Regular, fontSize: 15 },

  // ── Compass ───────────────────────────────────────────────────────────────────
  compassZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: BORDER,
  },
  compassRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardinal: {
    position: 'absolute',
    fontFamily: SORA.Bold,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },

  // ── Info panel ────────────────────────────────────────────────────────────────
  infoPanel: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  distanceValue: {
    fontSize: 64,
    fontFamily: SORA.Bold,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: -1,
    marginBottom: 8,
  },
  revealRow: {
    marginBottom: 20,
    alignItems: 'center',
  },
  placeName: {
    color: GOLD,
    fontFamily: SORA.SemiBold,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  redactedBlock: { alignItems: 'center', gap: 4 },
  redactedText: {
    color: MUTED,
    fontFamily: SORA.Bold,
    fontSize: 22,
    letterSpacing: 2,
  },
  redactedHint: {
    color: MUTED,
    fontFamily: SORA.Regular,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── Data strip ────────────────────────────────────────────────────────────────
  dataStrip: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    width: '100%',
    paddingVertical: 14,
  },
  dataCell: { flex: 1, alignItems: 'center' },
  dataDivider: { width: 1, backgroundColor: BORDER },
  dataLabel: {
    color: MUTED,
    fontFamily: SORA.Regular,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  dataValue: {
    color: WHITE,
    fontFamily: SORA.Bold,
    fontWeight: '700',
    fontSize: 18,
  },

  // ── Back ──────────────────────────────────────────────────────────────────────
  backButton: {
    paddingVertical: 16,
    paddingBottom: 34,
  },
  backButtonText: {
    color: MUTED,
    fontFamily: SORA.SemiBold,
    fontSize: 12,
    letterSpacing: 2,
  },
});
