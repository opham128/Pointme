import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { getDistancePreferences, saveDistancePreferences, DistancePreferences } from '../services/storage';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { hasPurchased } = useAppContext();
  const [preferences, setPreferences] = useState<DistancePreferences>({ enabled: false });
  const [minDistance, setMinDistance] = useState<string>('');
  const [maxDistance, setMaxDistance] = useState<string>('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const prefs = await getDistancePreferences();
    setPreferences(prefs);
    setMinDistance(prefs.minDistanceMiles?.toString() || '');
    setMaxDistance(prefs.maxDistanceMiles?.toString() || '');
  };

  const handleSave = async () => {
    const newPreferences: DistancePreferences = {
      enabled: preferences.enabled,
      minDistanceMiles: minDistance ? parseFloat(minDistance) : undefined,
      maxDistanceMiles: maxDistance ? parseFloat(maxDistance) : undefined,
    };
    
    await saveDistancePreferences(newPreferences);
    setPreferences(newPreferences);
    alert('Distance preferences saved!');
  };

  if (!hasPurchased) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={[styles.lockedTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            Premium Feature
          </Text>
          <Text style={[styles.lockedText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
            Distance filtering is available for premium users only.
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: '#007AFF' }]}
            onPress={() => router.push('/paywall')}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Distance Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                Distance Filtering
              </Text>
              <Text style={[styles.settingDescription, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                Filter places by distance range (in miles)
              </Text>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={(value) => setPreferences({ ...preferences, enabled: value })}
              trackColor={{ false: isDark ? '#2C2C2E' : '#E5E5EA', true: '#007AFF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {preferences.enabled && (
          <View style={[styles.section, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              Distance Range (miles)
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                Minimum Distance (optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                    color: isDark ? '#FFFFFF' : '#000000',
                    borderColor: isDark ? '#3A3A3C' : '#E5E5EA',
                  },
                ]}
                value={minDistance}
                onChangeText={setMinDistance}
                placeholder="0.5"
                placeholderTextColor={isDark ? '#8E8E93' : '#6E6E73'}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.inputHint, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                Leave empty for no minimum
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                Maximum Distance (optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                    color: isDark ? '#FFFFFF' : '#000000',
                    borderColor: isDark ? '#3A3A3C' : '#E5E5EA',
                  },
                ]}
                value={maxDistance}
                onChangeText={setMaxDistance}
                placeholder="2.0"
                placeholderTextColor={isDark ? '#8E8E93' : '#6E6E73'}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.inputHint, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                Leave empty for no maximum
              </Text>
            </View>

            <Text style={[styles.exampleText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
              Example: Min 0.5, Max 2.0 will only show places between 0.5 and 2 miles away
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: '#007AFF' }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        </TouchableOpacity>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
  exampleText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  lockedText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  upgradeButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});


