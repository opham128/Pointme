import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { clearArrivalHistory } from '../services/storage';

export default function HistoryScreen() {
  const isDark = true; // Always dark mode
  const router = useRouter();
  const { arrivalHistory, arrivalCount, refreshHistory } = useAppContext();

  const handleClearHistory = async () => {
    await clearArrivalHistory();
    await refreshHistory();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: '#2C2C2E' }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: '#FFFFFF' }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsContainer}>
          <Text style={[styles.statsNumber, { color: '#FFFFFF' }]}>
            {arrivalCount}
          </Text>
          <Text style={[styles.statsLabel, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
            Total Arrivals
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>
          Recent Arrivals
        </Text>

        {arrivalHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
              No arrivals yet. Start exploring!
            </Text>
          </View>
        ) : (
          arrivalHistory.map((item, index) => (
            <View
              key={`${item.place.placeId || index}-${item.arrivedAt}`}
              style={[
                styles.historyItem,
                { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
              ]}
            >
              <View style={styles.historyItemContent}>
                <Text style={[styles.historyItemName, { color: '#FFFFFF' }]}>
                  {item.place.name}
                </Text>
                {item.place.address && (
                  <Text style={[styles.historyItemAddress, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                    {item.place.address}
                  </Text>
                )}
                <Text style={[styles.historyItemDate, { color: isDark ? '#8E8E93' : '#6E6E73' }]}>
                  {formatDate(item.arrivedAt)}
                </Text>
              </View>
            </View>
          ))
        )}

        {arrivalHistory.length > 0 && (
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: '#2C2C2E' }]}
            onPress={handleClearHistory}
          >
            <Text style={[styles.clearButtonText, { color: isDark ? '#FF3B30' : '#FF3B30' }]}>
              Clear History
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  statsNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  historyItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyItemContent: {
    gap: 4,
  },
  historyItemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyItemAddress: {
    fontSize: 14,
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 12,
    marginTop: 4,
  },
  clearButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

