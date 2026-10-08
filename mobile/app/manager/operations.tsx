import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ManagerShell,
  FeedbackBox,
  EmptyState,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import { RefreshIcon } from '../../src/components/manager/ManagerIcons';
import { getLiveOverview, LiveOperationsData } from '../../src/services/managerData';
import { StaffTable } from '../../src/services/staffData';

const redOccupied = '#D92D4B';
const tealAvailable = '#0E9384';
const amberReserved = '#F79009';
const blueCleaning = '#2E90FA';

export default function LiveOperationsScreen() {
  const [activeSegment, setActiveSegment] = useState<'tables' | 'queue'>('tables');
  const [data, setData] = useState<LiveOperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<StaffTable | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getLiveOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load live operations data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      const interval = setInterval(() => void loadData(true), 15000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const tables = data?.tables || [];
  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const reservedCount = tables.filter((t) => t.status === 'reserved').length;
  const cleaningCount = tables.filter((t) => t.status === 'cleaning').length;

  const getTableColor = (status: string) => {
    switch (status) {
      case 'available':
        return tealAvailable;
      case 'occupied':
        return redOccupied;
      case 'reserved':
        return amberReserved;
      case 'cleaning':
        return blueCleaning;
      default:
        return tealAvailable;
    }
  };

  const headerAction = (
    <Pressable
      style={styles.refreshBtn}
      onPress={() => void loadData(true)}
      accessibilityRole="button"
      accessibilityLabel="Refresh"
    >
      <RefreshIcon size={20} color="#344054" />
    </Pressable>
  );

  const footer = (
    <Pressable
      style={styles.viewDetailsBtn}
      onPress={() => router.push('/manager/reservations')}
      accessibilityRole="button"
      accessibilityLabel="View Table Details"
    >
      <Text style={styles.viewDetailsBtnText}>
        {selectedTable
          ? `Table ${selectedTable.number} (${selectedTable.status.toUpperCase()}) — View Details`
          : 'View Table Details'}
      </Text>
    </Pressable>
  );

  return (
    <ManagerShell
      title="Live Operations"
      tab="operations"
      headerAction={headerAction}
      footer={footer}
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={() => void loadData()} />

      {/* Segmented Toggle: Tables | Queue */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentBtn, activeSegment === 'tables' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('tables')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSegment === 'tables' }}
        >
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'tables' && styles.segmentTextActive,
            ]}
          >
            Tables
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, activeSegment === 'queue' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('queue')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSegment === 'queue' }}
        >
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'queue' && styles.segmentTextActive,
            ]}
          >
            Queue
          </Text>
        </Pressable>
      </View>

      {/* Legend Row */}
      <View style={styles.legendContainer}>
        <View style={styles.legendCol}>
          <View style={styles.legendRowItem}>
            <View style={[styles.dot, { backgroundColor: tealAvailable }]} />
            <Text style={styles.legendLabel}>Available {availableCount}</Text>
          </View>
          <View style={styles.legendRowItem}>
            <View style={[styles.dot, { backgroundColor: amberReserved }]} />
            <Text style={styles.legendLabel}>Reserved {reservedCount}</Text>
          </View>
        </View>
        <View style={styles.legendCol}>
          <View style={styles.legendRowItem}>
            <View style={[styles.dot, { backgroundColor: redOccupied }]} />
            <Text style={styles.legendLabel}>Occupied {occupiedCount}</Text>
          </View>
          <View style={styles.legendRowItem}>
            <View style={[styles.dot, { backgroundColor: blueCleaning }]} />
            <Text style={styles.legendLabel}>Cleaning {cleaningCount}</Text>
          </View>
        </View>
      </View>

      {/* Floor Plan Card */}
      {activeSegment === 'tables' ? (
        <View style={styles.floorCard}>
          <View style={styles.gridContainer}>
            {tables.map((table) => {
              const bgColor = getTableColor(table.status);
              const isSelected = selectedTable?.number === table.number;

              return (
                <Pressable
                  key={table._id || table.number}
                  style={[
                    styles.tableBox,
                    { backgroundColor: bgColor },
                    isSelected && styles.tableBoxSelected,
                  ]}
                  onPress={() => setSelectedTable(table)}
                >
                  <Text style={styles.tableBoxText}>{table.number}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.divider} />
          <Text style={styles.floorSubtitle}>MAIN DINING AREA</Text>
        </View>
      ) : (
        /* Queue View */
        <View style={styles.queueContainer}>
          <Text style={styles.queueHeader}>
            Live Waiting Parties ({data?.queueParties.length || 0})
          </Text>
          {data?.queueParties && data.queueParties.length > 0 ? (
            data.queueParties.map((p) => (
              <View key={p._id} style={styles.queueCard}>
                <View style={styles.queueCardLeft}>
                  <Text style={styles.queueNum}>{p.number}</Text>
                  <Text style={styles.queueName}>{p.customerName}</Text>
                  <Text style={styles.queueMeta}>
                    {p.partySize} guests · {p.mobileNumber}
                  </Text>
                </View>
                <View style={[styles.queueBadge, { backgroundColor: '#E9F6EF' }]}>
                  <Text style={{ color: '#208064', fontSize: 11, fontWeight: '700' }}>
                    {p.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              title="Queue is Empty"
              detail="There are currently no parties waiting in the queue."
            />
          )}
        </View>
      )}
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  refreshBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 8,
  },
  segmentBtn: {
    paddingHorizontal: 36,
    paddingVertical: 10,
    borderRadius: 22,
  },
  segmentBtnActive: {
    backgroundColor: burgundy,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#697386',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    marginVertical: 12,
  },
  legendCol: {
    gap: 8,
  },
  legendRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: '#344054',
    fontWeight: '500',
  },
  floorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#EDEEF2',
    boxShadow: '0 2px 4px rgba(16,24,40,0.04)',
    alignItems: 'center',
    marginTop: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 14,
  },
  tableBox: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  tableBoxSelected: {
    borderWidth: 3,
    borderColor: '#151D2E',
  },
  tableBoxText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F4F7',
    width: '100%',
    marginVertical: 18,
  },
  floorSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#98A2B3',
    letterSpacing: 1.2,
  },
  viewDetailsBtn: {
    backgroundColor: burgundy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  queueContainer: {
    gap: 10,
    marginTop: 8,
  },
  queueHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: darkText,
    marginBottom: 4,
  },
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDEEF2',
  },
  queueCardLeft: {
    gap: 3,
  },
  queueNum: {
    fontSize: 11,
    fontWeight: '700',
    color: burgundy,
  },
  queueName: {
    fontSize: 15,
    fontWeight: '600',
    color: darkText,
  },
  queueMeta: {
    fontSize: 12,
    color: '#697386',
  },
  queueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
