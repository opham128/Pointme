import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { SORA } from '../constants/fonts';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { hasPurchased } = useAppContext();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
          <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            Distance Filtering
          </Text>
          <Text style={[styles.settingDescription, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
            Distance filtering has been removed from the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: SORA.Bold,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: SORA.SemiBold,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    fontFamily: SORA.Regular,
  },
});
