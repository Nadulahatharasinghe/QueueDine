import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import { createReservation } from '../../src/services/reservationService';
import { getFirstRestaurant } from '../../src/services/restaurantService';

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

export default function SummaryScreen() {
  const p = useLocalSearchParams<{
    restaurantId: string;
    tableId: string;
    tableNumber: string;
    tableCapacity: string;
    date: string;
    time: string;
    guests: string;
  }>();

  const [restaurantName, setRestaurantName] = useState<string>('Restaurant');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getFirstRestaurant();
        if (r) setRestaurantName(r.name);
      } catch {
        // ignore
      }
    })();
  }, []);

  const onConfirm = async () => {
    try {
      setCreating(true);
      setError('');
      const guestsNum = Number(p.guests);
      const reservation = await createReservation({
        restaurantId: p.restaurantId,
        tableId: p.tableId,
        date: p.date,
        time: p.time,
        guests: guestsNum,
      });
      router.replace({
        pathname: '/reservation/[id]',
        params: { id: reservation._id },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to confirm reservation';
      setError(msg);
      Alert.alert('Reservation Error', msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Summary</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>{'\u{1F4C5}'} Reservation Summary</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Restaurant</Text>
            <Text style={styles.rowValue}>{restaurantName}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Date</Text>
            <Text style={styles.rowValue}>{formatDateDisplay(p.date)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Time</Text>
            <Text style={styles.rowValue}>{formatTime12(p.time)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Party Size</Text>
            <Text style={styles.rowValue}>{p.guests} people</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Table</Text>
            <Text style={styles.rowValue}>
              #{p.tableNumber} (up to {p.tableCapacity} guests)
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ height: SPACING.lg }} />
        <CustomButton
          title="Confirm Reservation"
          variant="primary"
          onPress={onConfirm}
          loading={creating}
          disabled={creating}
          style={styles.confirmButton}
        />
      </ScrollView>
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.md,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardHeaderTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
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
  error: {
    marginTop: SPACING.lg,
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  confirmButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
  },
});
