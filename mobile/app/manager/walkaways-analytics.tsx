import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ManagerShell,
  FeedbackBox,
  darkText,
} from '../../src/components/manager/ManagerUI';
import {
  WalkawaysChart,
  NoShowsBarChart,
} from '../../src/components/manager/Charts';
import { CalendarIcon, ChevronDownIcon } from '../../src/components/manager/ManagerIcons';
import {
  getWalkawaysAnalytics,
  WalkawaysAnalyticsData,
} from '../../src/services/managerData';

export default function WalkawaysAnalyticsScreen() {
  const params = useLocalSearchParams<{
    range?: string;
    rangeLabel?: string;
    from?: string;
    to?: string;
  }>();
  const activeRange = params.range || 'last-7-days';
  const fromParam = params.from;
  const toParam = params.to;

  const [data, setData] = useState<WalkawaysAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getWalkawaysAnalytics(activeRange, fromParam, toParam);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load walkaways analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRange, fromParam, toParam]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  return (
    <ManagerShell
      title="Walkaways & No-shows"
      tab="analytics"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={() => void loadData()} />

      {/* Date Range Dropdown */}
      <Pressable
        style={styles.dateBar}
        onPress={() => router.push({
          pathname: '/manager/date-range',
          params: {
            returnTo: '/manager/walkaways-analytics',
            currentRange: data?.rangeLabel || params.rangeLabel || 'Last 7 Days',
            from: fromParam,
            to: toParam,
          },
        })}
        accessibilityRole="button"
        accessibilityLabel="Select date range"
      >
        <View style={styles.dateBarLeft}>
          <CalendarIcon size={16} color="#697386" />
          <Text style={styles.dateBarText}>
            {data?.rangeLabel || params.rangeLabel || 'Last 7 Days'}
          </Text>
        </View>
        <ChevronDownIcon size={12} color="#697386" />
      </Pressable>

      {/* 2 Metric Cards */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Walkaways</Text>
          <View style={styles.metricValRow}>
            <Text style={styles.metricNumber}>
              {data ? data.walkaways.count : '--'}
            </Text>
            {data?.walkaways.rate ? (
              <Text style={styles.metricRate}>({data.walkaways.rate})</Text>
            ) : null}
          </View>
          {data?.walkaways.delta ? (
            <Text style={data.walkaways.isPositive ? styles.deltaPositive : styles.deltaNegative}>
              {data.walkaways.isPositive ? '▲ ' : '▼ '}
              {data.walkaways.delta.replace(/[+-]/, '')}
            </Text>
          ) : null}
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>No-shows</Text>
          <View style={styles.metricValRow}>
            <Text style={styles.metricNumber}>
              {data ? data.noShows.count : '--'}
            </Text>
            {data?.noShows.rate ? (
              <Text style={styles.metricRate}>({data.noShows.rate})</Text>
            ) : null}
          </View>
          {data?.noShows.delta ? (
            <Text style={data.noShows.isPositive ? styles.deltaPositive : styles.deltaNegative}>
              {data.noShows.isPositive ? '▲ ' : '▼ '}
              {data.noShows.delta.replace(/[+-]/, '')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Walkaways by Hour with real data */}
      <WalkawaysChart data={data?.walkawaysByHour} />

      {/* No-shows by Reservation Time with real data */}
      <NoShowsBarChart data={data?.noShowsByReservationTime} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
  },
  dateBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkText,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
    gap: 6,
  },
  metricTitle: {
    fontSize: 12,
    color: '#697386',
    fontWeight: '500',
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: darkText,
  },
  metricRate: {
    fontSize: 13,
    color: '#697386',
    fontWeight: '500',
  },
  deltaNegative: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D92D4B',
  },
  deltaPositive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E9384',
  },
});
