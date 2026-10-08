import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ManagerShell,
  FeedbackBox,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import { CalendarIcon, ChevronDownIcon } from '../../src/components/manager/ManagerIcons';
import {
  getDailyReportPreview,
  StaffReportData,
} from '../../src/services/managerData';

export default function EndOfDayReportScreen() {
  const params = useLocalSearchParams<{
    range?: string;
    rangeLabel?: string;
    date?: string;
    from?: string;
    to?: string;
  }>();

  const activeDate = params.date || params.from || (params.range === 'yesterday' ? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })() : new Date().toISOString().slice(0, 10));

  const [data, setData] = useState<StaffReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getDailyReportPreview(activeDate);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load end of day report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeDate]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  return (
    <ManagerShell
      title="End of Day Report"
      tab="reports"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={() => void loadData()} />

      {/* Date Dropdown */}
      <Pressable
        style={styles.dateBar}
        onPress={() => router.push({
          pathname: '/manager/date-range',
          params: {
            returnTo: '/manager/reports',
            currentRange: data?.dateLabel || params.rangeLabel || 'Today',
            from: activeDate,
            to: activeDate,
          },
        })}
        accessibilityRole="button"
        accessibilityLabel="Select date range"
      >
        <View style={styles.dateBarLeft}>
          <CalendarIcon size={16} color="#697386" />
          <Text style={styles.dateBarText}>
            {data?.dateLabel || new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <ChevronDownIcon size={12} color="#697386" />
      </Pressable>

      {/* 2x3 Grid of 6 Metric Cards */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Reservations</Text>
            <Text style={styles.cardValue}>{data ? data.totalReservations : '--'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Walk-ins</Text>
            <Text style={styles.cardValue}>{data ? data.walkIns : '--'}</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Customers Seated</Text>
            <Text style={styles.cardValue}>{data ? data.customersSeated : '--'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Average Wait Time</Text>
            <Text style={styles.cardValue}>
              {data ? `${data.avgWaitTime} min` : '--'}
            </Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>No-shows</Text>
            <View style={styles.inlineRateRow}>
              <Text style={styles.cardValue}>{data ? data.noShowsCount : '--'}</Text>
              {data && (
                <Text style={styles.cardRate}>({data.noShowsPercent}%)</Text>
              )}
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Walkaways</Text>
            <View style={styles.inlineRateRow}>
              <Text style={styles.cardValue}>{data ? data.walkawaysCount : '--'}</Text>
              {data && (
                <Text style={styles.cardRate}>({data.walkawaysPercent}%)</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Primary Action Button: View Full Report */}
      <Pressable
        style={styles.primaryBtn}
        onPress={() => router.push({ pathname: '/manager/daily-report', params: { date: activeDate } })}
        accessibilityRole="button"
        accessibilityLabel="View Full Report"
      >
        <Text style={styles.primaryBtnText}>View Full Report</Text>
      </Pressable>
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 4,
  },
  dateBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkText,
  },
  chevron: {
    fontSize: 14,
    color: '#697386',
    marginTop: -2,
  },
  grid: {
    gap: 12,
    marginVertical: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
    gap: 6,
    minHeight: 88,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    color: '#697386',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '800',
    color: darkText,
  },
  inlineRateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  cardRate: {
    fontSize: 14,
    color: '#697386',
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: burgundy,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
