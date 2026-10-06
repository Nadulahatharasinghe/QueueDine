import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../src/constants/theme';
import ScreenContainer from '../src/components/ScreenContainer';
import { getReservations } from '../src/services/reservationService';
import { Reservation } from '../src/types';

type FilterType = 'all' | 'confirmed' | 'cancelled' | 'completed';

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatTime12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const statusColor = (s: string) => {
  switch (s) {
    case 'confirmed':
      return COLORS.success;
    case 'cancelled':
      return COLORS.error;
    case 'completed':
      return COLORS.info;
    default:
      return COLORS.warning;
  }
};

export default function ReservationsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const load = useCallback(async () => {
    try {
      const data = await getReservations();
      setReservations(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bookings</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'confirmed', 'cancelled', 'completed'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : reservations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{'\u{1F4C5}'}</Text>
          <Text style={styles.emptyTitle}>No reservations yet</Text>
          <Text style={styles.emptyDesc}>
            Book a table from a restaurant to see it here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/restaurant')}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Find a Restaurant</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {filteredReservations.map((r) => {
            const restaurant =
              typeof r.restaurantId === 'object' ? r.restaurantId : null;
            const table = typeof r.tableId === 'object' ? r.tableId : null;
            return (
              <TouchableOpacity
                key={r._id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/reservation/[id]',
                    params: { id: r._id },
                  })
                }
              >
                <View style={styles.cardTop}>
                  <Text style={styles.restaurantName}>
                    {restaurant?.name || 'Restaurant'}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor(r.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusColor(r.status) },
                      ]}
                    >
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>{'\u{1F4C5}'}</Text>
                    <Text style={styles.detailText}>
                      {formatDate(r.date)} \u2022 {formatTime12(r.time)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>{'\u{1F465}'}</Text>
                    <Text style={styles.detailText}>{r.guests} people</Text>
                  </View>
                  {table ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>{'\u{1FA91}'}</Text>
                      <Text style={styles.detailText}>Table {table.tableNumber}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.bold,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  restaurantName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  cardDetails: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: FONT_SIZES.md,
    marginRight: SPACING.sm,
    color: COLORS.textSecondary,
    width: 22,
    textAlign: 'center',
  },
  detailText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
});
