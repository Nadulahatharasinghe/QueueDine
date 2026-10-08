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
  OccupancyByDayChart,
  TableUtilizationDonut,
} from '../../src/components/manager/Charts';
import {
  CalendarIcon,
  ChevronDownIcon,
  FilterIcon,
} from '../../src/components/manager/ManagerIcons';
import {
  getOccupancyAnalytics,
  OccupancyAnalyticsData,
} from '../../src/services/managerData';

export default function OccupancyAnalyticsScreen() {
  const params = useLocalSearchParams<{
    range?: string;
    rangeLabel?: string;
    from?: string;
    to?: string;
  }>();

  const activeRange = params.range || 'last-7-days';
  const fromParam = params.from;
  const toParam = params.to;

  const [data, setData] = useState<OccupancyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getOccupancyAnalytics(activeRange, fromParam, toParam);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load occupancy analytics.');
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

  const openDateRangePicker = () => {
    router.push({
      pathname: '/manager/date-range',
      params: {
        returnTo: '/manager/analytics',
        currentRange: data?.rangeLabel || params.rangeLabel || 'Last 7 Days',
        from: fromParam,
        to: toParam,
      },
    });
  };

  const headerAction = (
    <Pressable
      style={styles.filterBtn}
      onPress={openDateRangePicker}
      accessibilityRole="button"
      accessibilityLabel="Filter range"
    >
      <FilterIcon size={18} color="#344054" />
    </Pressable>
  );

  const occupiedPct =
    data?.tableUtilization?.segments?.find((s) => s.label.toLowerCase() === 'occupied')?.percent ?? 0;
  const availablePct =
    data?.tableUtilization?.segments?.find((s) => s.label.toLowerCase() === 'available')?.percent ?? 0;
  const reservedPct =
    data?.tableUtilization?.segments?.find((s) => s.label.toLowerCase() === 'reserved')?.percent ?? 0;
  const cleaningPct =
    data?.tableUtilization?.segments?.find((s) => s.label.toLowerCase() === 'cleaning')?.percent ?? 0;

  return (
    <ManagerShell
      title="Occupancy Analytics"
      tab="analytics"
      headerAction={headerAction}
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={() => void loadData()} />

      {/* Date selector with funnel filter */}
      <View style={styles.dateFilterRow}>
        <Pressable
          style={styles.datePill}
          onPress={openDateRangePicker}
          accessibilityRole="button"
          accessibilityLabel="Select date range"
        >
          <CalendarIcon size={16} color="#697386" />
          <Text style={styles.datePillText}>
            {data?.rangeLabel || params.rangeLabel || 'Last 7 Days'}
          </Text>
          <ChevronDownIcon size={12} color="#697386" />
        </Pressable>
        <Pressable
          style={styles.funnelBtn}
          onPress={openDateRangePicker}
          accessibilityRole="button"
          accessibilityLabel="Filter options"
        >
          <FilterIcon size={18} color="#344054" />
        </Pressable>
      </View>

      {/* 2 Metric Cards */}
      <View style={styles.metricsRow}>
        <MetricCard
          value={data ? `${data.avgOccupancy.value}%` : '--'}
          label="Average Occupancy"
          delta={data?.avgOccupancy.delta}
          isPositive={data?.avgOccupancy.isPositive ?? true}
        />
        <MetricCard
          value={data ? String(data.avgTableTurnover.value) : '--'}
          label="Avg. Table Turnover"
          delta={data?.avgTableTurnover.delta}
          isPositive={data?.avgTableTurnover.isPositive ?? true}
        />
      </View>

      {/* Occupancy by Hour / Day with fixed headroom */}
      <OccupancyByDayChart data={data?.occupancyByHour} />

      {/* Table Utilization Donut Chart with live database segments */}
      <TableUtilizationDonut
        occupied={occupiedPct}
        available={availablePct}
        reserved={reservedPct}
        cleaning={cleaningPct}
      />
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  filterBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  datePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkText,
  },
  funnelBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
});
