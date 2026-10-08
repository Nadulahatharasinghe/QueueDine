import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ManagerShell,
  MetricCard,
  FeedbackBox,
  darkText,
} from '../../src/components/manager/ManagerUI';
import {
  QueueVolumeChart,
  WaitTimeDistributionList,
} from '../../src/components/manager/Charts';
import { CalendarIcon, ChevronDownIcon } from '../../src/components/manager/ManagerIcons';
import {
  getQueueAnalytics,
  QueueAnalyticsData,
} from '../../src/services/managerData';

export default function QueueAnalyticsScreen() {
  const params = useLocalSearchParams<{
    range?: string;
    rangeLabel?: string;
    from?: string;
    to?: string;
  }>();
  const activeRange = params.range || 'today';
  const fromParam = params.from;
  const toParam = params.to;

  const [data, setData] = useState<QueueAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getQueueAnalytics(activeRange, fromParam, toParam);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load queue analytics.');
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
      title="Queue Analytics"
      tab="analytics"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={() => void loadData()} />

      {/* Date Dropdown */}
      <View style={styles.dropdownRow}>
        <Pressable
          style={styles.dropdownPill}
          onPress={() => router.push({
            pathname: '/manager/date-range',
            params: {
              returnTo: '/manager/queue-analytics',
              currentRange: data?.rangeLabel || params.rangeLabel || 'Today',
              from: fromParam,
              to: toParam,
            },
          })}
          accessibilityRole="button"
          accessibilityLabel="Select date range"
        >
          <CalendarIcon size={14} color="#697386" />
          <Text style={styles.dropdownPillText}>
            {data?.rangeLabel || params.rangeLabel || 'Today'}
          </Text>
          <ChevronDownIcon size={11} color="#697386" />
        </Pressable>
      </View>

      {/* 2 Metric Cards */}
      <View style={styles.metricsRow}>
        <MetricCard
          value={data ? String(data.totalQueued.value) : '--'}
          label="Total Queued"
          delta={data?.totalQueued.delta}
          isPositive={data?.totalQueued.isPositive ?? true}
        />
        <MetricCard
          value={data ? `${data.avgWaitTime.value} min` : '--'}
          label="Avg. Wait Time"
          delta={data?.avgWaitTime.delta}
          isPositive={data?.avgWaitTime.isPositive ?? true}
        />
      </View>

      {/* Queue Volume by Hour with real data */}
      <QueueVolumeChart data={data?.queueVolumeByHour} />

      {/* Wait Time Distribution with real data */}
      <WaitTimeDistributionList data={data?.waitTimeDistribution} />
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  dropdownRow: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  dropdownPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: darkText,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
});
