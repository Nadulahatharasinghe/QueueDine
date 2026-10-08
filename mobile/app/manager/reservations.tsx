import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  ManagerShell,
  FeedbackBox,
  EmptyState,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import { getManagerReservations } from '../../src/services/managerData';
import { Party } from '../../src/services/staffData';

export default function ReservationsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [reservations, setReservations] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getManagerReservations(activeTab);
      setReservations(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load reservations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const formatTime = (bookingAt?: string) => {
    if (!bookingAt) return '--:--';
    const d = new Date(bookingAt);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'arrived':
        return { label: 'Arriving', bg: '#E9F6EF', text: '#208064' };
      case 'waiting':
        return { label: 'Pending', bg: '#FFF8DD', text: '#A77B15' };
      case 'seated':
        return { label: 'Seated', bg: '#E9F6EF', text: '#208064' };
      case 'cancelled':
        return { label: 'Cancelled', bg: '#FBECEE', text: '#A52940' };
      case 'no-show':
        return { label: 'No-show', bg: '#FBECEE', text: '#A52940' };
      default:
        return { label: 'Confirmed', bg: '#EBF3FC', text: '#2060B4' };
    }
  };

  const todayLabel = new Date()
    .toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();

  return (
    <ManagerShell
      title="Reservations"
      tab="operations"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox
        loading={loading && !reservations.length}
        error={error}
        retry={() => void loadData()}
      />

      {/* Tabs: Upcoming | Past */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setActiveTab('upcoming')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'upcoming' }}
        >
          <View style={styles.tabContentRow}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'upcoming' && styles.tabTextActive,
              ]}
            >
              Upcoming
            </Text>
            {activeTab === 'upcoming' && reservations.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{reservations.length}</Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'past' && styles.tabBtnActive]}
          onPress={() => setActiveTab('past')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'past' }}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </Pressable>
      </View>

      {/* Section Subheader */}
      <Text style={styles.sectionDate}>TODAY, {todayLabel}</Text>

      {/* Reservation Cards List or Empty State */}
      {reservations.length > 0 ? (
        <View style={styles.listContainer}>
          {reservations.map((item) => {
            const badge = getStatusBadge(item.status);
            return (
              <View key={item._id} style={styles.card}>
                <Text style={styles.timeText}>{formatTime(item.bookingAt)}</Text>
                <View style={styles.cardCenter}>
                  <Text style={styles.nameText}>{item.customerName}</Text>
                  <Text style={styles.peopleText}>
                    {item.partySize} {item.partySize === 1 ? 'person' : 'people'}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            );
          })}
        </View>
      ) : !loading ? (
        <EmptyState
          title={`No ${activeTab === 'upcoming' ? 'Upcoming' : 'Past'} Reservations`}
          detail={
            activeTab === 'upcoming'
              ? 'There are currently no upcoming reservations scheduled for today.'
              : 'There are no past reservations recorded.'
          }
        />
      ) : null}
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: burgundy,
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#98A2B3',
  },
  tabTextActive: {
    color: burgundy,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: burgundy,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#697386',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  listContainer: {
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
  },
  timeText: {
    width: 76,
    fontSize: 14,
    fontWeight: '700',
    color: darkText,
  },
  cardCenter: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: darkText,
  },
  peopleText: {
    fontSize: 12,
    color: '#697386',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 18,
    color: '#98A2B3',
  },
});
