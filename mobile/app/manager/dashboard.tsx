import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ManagerShell,
  MetricCard,
  DateSelectorBar,
  FeedbackBox,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import { OccupancyTrendChart } from '../../src/components/manager/Charts';
import { BrandFlame, BellIcon, UserAvatar } from '../../src/components/manager/ManagerIcons';
import {
  getManagerDashboard,
  ManagerDashboardData,
} from '../../src/services/managerData';

export default function ManagerDashboardScreen() {
  const params = useLocalSearchParams<{
    range?: string;
    rangeLabel?: string;
    from?: string;
    to?: string;
    date?: string;
  }>();

  const activeRange = params.range || params.date || 'today';
  const fromParam = params.from;
  const toParam = params.to;

  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getManagerDashboard(activeRange, fromParam, toParam);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRange, fromParam, toParam]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      const interval = setInterval(() => void loadData(true), 15000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const customHeader = (
    <View style={styles.topHeader}>
      <View style={styles.brandRow}>
        <View style={styles.flameIconBox}>
          <BrandFlame size={26} />
        </View>
        <View>
          <View style={styles.subBrandRow}>
            <Text style={styles.brandSubtitle}>QUEUEDINE</Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.roleTag}>Manager</Text>
          </View>
          <Text style={styles.restaurantName}>
            {data?.restaurant?.name || 'Ember & Oak'}
          </Text>
          <Text style={styles.locationText}>
            {data?.restaurant?.location ? `${data.restaurant.location}, Sri Lanka` : 'Colombo, Sri Lanka'}
          </Text>
        </View>
      </View>
      <View style={styles.headerRightActions}>
        <Pressable
          style={styles.bellButton}
          onPress={() => router.push('/manager/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <BellIcon size={20} color="#344054" />
          <View style={styles.unreadDot} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/manager/profile')}
          accessibilityRole="button"
          accessibilityLabel="Manager Profile"
        >
          <UserAvatar
            initials={
              (data?.user?.fullName || 'R. Perera')
                .split(' ')
                .filter(Boolean)
                .map((p) => p[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'RP'
            }
            size={38}
          />
        </Pressable>
      </View>
    </View>
  );

  return (
    <ManagerShell
      tab="dashboard"
      customHeader={customHeader}
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={() => void loadData()} />

      {/* Date Bar */}
      <DateSelectorBar
        dateText={data?.dateLabel || 'Today'}
        rangeText={params.rangeLabel || (activeRange === 'today' ? 'Today' : activeRange === 'yesterday' ? 'Yesterday' : activeRange === 'last-7-days' ? 'Last 7 Days' : activeRange === 'last-30-days' ? 'Last 30 Days' : 'Custom')}
        onPress={() => router.push({
          pathname: '/manager/date-range',
          params: {
            returnTo: '/manager/dashboard',
            currentRange: params.rangeLabel || (activeRange === 'today' ? 'Today' : activeRange === 'yesterday' ? 'Yesterday' : activeRange === 'last-7-days' ? 'Last 7 Days' : activeRange === 'last-30-days' ? 'Last 30 Days' : 'Custom Range'),
            from: fromParam,
            to: toParam,
          },
        })}
      />

      {/* Key Metrics Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Key Metrics</Text>
      </View>

      {/* 2x3 Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.gridRow}>
          <MetricCard
            value={data ? `${data.keyMetrics.occupancy.value}%` : '0%'}
            label="Occupancy"
            delta={data?.keyMetrics.occupancy.delta}
            isPositive={true}
            toneColor="#0E9384"
            onPress={() => router.push('/manager/analytics')}
          />
          <MetricCard
            value={data ? String(data.keyMetrics.waiting.value) : '0'}
            label="Waiting"
            delta={data?.keyMetrics.waiting.delta}
            isPositive={true}
            toneColor={burgundy}
            onPress={() => router.push('/manager/queue-analytics')}
          />
          <MetricCard
            value={data ? String(data.keyMetrics.availableTables.value) : '0'}
            label="Available Tables"
            toneColor="#2E90FA"
            onPress={() => router.push('/manager/operations')}
          />
        </View>
        <View style={styles.gridRow}>
          <MetricCard
            value={data ? `${data.keyMetrics.avgWaitTime.value} min` : '0 min'}
            label="Avg. Wait Time"
            delta={data?.keyMetrics.avgWaitTime.delta}
            isPositive={true}
            onPress={() => router.push('/manager/queue-analytics')}
          />
          <MetricCard
            value={data ? String(data.keyMetrics.walkaways.value) : '0'}
            label="Walkaways"
            delta={data?.keyMetrics.walkaways.delta}
            isPositive={false}
            onPress={() => router.push('/manager/walkaways-analytics')}
          />
          <MetricCard
            value={data ? String(data.keyMetrics.noShows.value) : '0'}
            label="No-shows"
            delta={data?.keyMetrics.noShows.delta}
            isPositive={true}
            onPress={() => router.push('/manager/walkaways-analytics')}
          />
        </View>
      </View>

      {/* Occupancy Trend Curve */}
      <OccupancyTrendChart
        peakLabel={data?.occupancyTrend.peakLabel}
        data={data?.occupancyTrend.data}
      />
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFC',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flameIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBECEE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0CED5',
  },
  subBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: burgundy,
    letterSpacing: 0.8,
  },
  dotSeparator: {
    fontSize: 10,
    color: '#98A2B3',
  },
  roleTag: {
    fontSize: 10,
    color: '#697386',
    fontWeight: '500',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: darkText,
    lineHeight: 22,
  },
  locationText: {
    fontSize: 11,
    color: '#98A2B3',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D92D4B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  sectionHeaderRow: {
    marginTop: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: darkText,
  },
  metricsGrid: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
