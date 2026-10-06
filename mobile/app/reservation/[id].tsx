import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';
import CustomButton from '../../src/components/CustomButton';
import ScreenContainer from '../../src/components/ScreenContainer';
import AnimatedPopup from '../../src/components/AnimatedPopup';
import {
  cancelReservation,
  getReservation,
} from '../../src/services/reservationService';
import { Reservation } from '../../src/types';

const formatDateDisplay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

export default function ReservationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelPopup, setCancelPopup] = useState<
    'confirmation' | 'success' | null
  >(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await getReservation(id);
      setReservation(r);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load reservation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void load();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const confirmCancel = async () => {
    try {
      setCancelling(true);
      const updated = await cancelReservation(id);
      setReservation(updated);
      setCancelPopup('success');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to cancel reservation';
      if (Platform.OS === 'web') {
        window.alert(`Cannot Cancel: ${msg}`);
      } else {
        Alert.alert('Cannot Cancel', msg);
      }
    } finally {
      setCancelling(false);
    }
  };

  const onCancel = () => {
    setCancelPopup('confirmation');
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!reservation) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Reservation not found'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const restaurant =
    typeof reservation.restaurantId === 'object' ? reservation.restaurantId : null;
  const table = typeof reservation.tableId === 'object' ? reservation.tableId : null;
  const status = reservation.status;
  const confirmed = status === 'confirmed';

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reservation Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.successHeader}>
          <View
            style={[
              styles.checkCircle,
              {
                backgroundColor:
                  status === 'cancelled'
                    ? COLORS.error
                    : status === 'completed'
                    ? COLORS.info
                    : COLORS.success,
              },
            ]}
          >
            <Text style={styles.checkMark}>
              {status === 'cancelled' ? '\u2717' : '\u2713'}
            </Text>
          </View>
          <Text style={styles.successTitle}>
            {status === 'cancelled'
              ? 'Reservation Cancelled'
              : status === 'completed'
              ? 'Reservation Completed'
              : 'Reservation Confirmed!'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Reservation ID</Text>
            <Text style={styles.rowValueMono}>{String(reservation._id).slice(-8)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Restaurant</Text>
            <Text style={styles.rowValue}>{restaurant?.name || 'Restaurant'}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Date</Text>
            <Text style={styles.rowValue}>{formatDateDisplay(reservation.date)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Time</Text>
            <Text style={styles.rowValue}>{formatTime12(reservation.time)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Party Size</Text>
            <Text style={styles.rowValue}>{reservation.guests} people</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Table</Text>
            <Text style={styles.rowValue}>
              {table ? `#${table.tableNumber} (${table.capacity} pax)` : 'Assigned'}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor(status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: statusColor(status) },
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: SPACING.xl }} />
        <CustomButton
          title="Modify Reservation"
          variant="outline"
          disabled={!confirmed}
          onPress={() => router.push({ pathname: '/reservation/edit', params: { id: String(id) } })}
          style={styles.modifyButton}
        />
        <View style={{ height: SPACING.md }} />
        <CustomButton
          title={cancelling ? 'Cancelling...' : 'Cancel Reservation'}
          variant="primary"
          disabled={!confirmed || cancelling}
          onPress={onCancel}
          style={[
            styles.cancelButton,
            !confirmed ? { backgroundColor: COLORS.surface, borderColor: COLORS.border } : undefined,
          ]}
          textStyle={confirmed ? { color: COLORS.white } : { color: COLORS.textLight }}
        />
      </ScrollView>
      <AnimatedPopup
        visible={cancelPopup !== null}
        variant={cancelPopup === 'confirmation' ? 'confirmation' : 'success'}
        title={
          cancelPopup === 'confirmation'
            ? 'Cancel Reservation?'
            : 'Reservation Cancelled'
        }
        message={
          cancelPopup === 'confirmation'
            ? 'Are you sure you want to cancel this reservation? This action cannot be undone.'
            : 'Your reservation has been cancelled successfully.'
        }
        buttonText={
          cancelPopup === 'confirmation' ? 'Yes, Cancel' : 'Done'
        }
        cancelText="Keep Reservation"
        onCancel={() => setCancelPopup(null)}
        onContinue={() => {
          if (cancelPopup === 'confirmation') {
            setCancelPopup(null);
            void confirmCancel();
          } else {
            setCancelPopup(null);
            if (router.canGoBack()) router.back();
          }
        }}
      />
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
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
  },
  successHeader: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  checkMark: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: FONT_WEIGHTS.bold,
  },
  successTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  rowLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
  },
  rowValueMono: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  modifyButton: {
    height: 54,
    borderRadius: BORDER_RADIUS.xl,
  },
  cancelButton: {
    height: 54,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});
