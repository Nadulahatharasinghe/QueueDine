import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
import { checkAvailability } from '../../src/services/reservationService';
import { getFirstRestaurant } from '../../src/services/restaurantService';
import { Table, TimeSlot } from '../../src/types';

const formatDateDisplay = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const TIME_OPTIONS = [
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '20:30', label: '8:30 PM' },
  { value: '21:00', label: '9:00 PM' },
];

export default function CreateReservationScreen() {
  const params = useLocalSearchParams<{ restaurantId?: string }>();

  const [restaurantId, setRestaurantId] = useState<string>('');
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [time, setTime] = useState<string>('19:00');
  const [party, setParty] = useState<number>(4);
  const [selectedSlot, setSelectedSlot] = useState<string>('7:00 PM');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (params.restaurantId) {
          setRestaurantId(params.restaurantId);
        } else {
          const r = await getFirstRestaurant();
          if (r) setRestaurantId(r._id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [params.restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    (async () => {
      try {
        setChecking(true);
        const res = await checkAvailability({
          restaurantId,
          date: toDateInput(date),
          time,
          guests: party,
        });
        if (cancel) return;
        setSlots(res.slots);
        setTables(res.availableTables);
      } catch (err: any) {
        if (!cancel) setError(err?.response?.data?.error || 'Failed to check availability');
      } finally {
        if (!cancel) setChecking(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId, date, time, party]);

  const continueEnabled = useMemo(() => {
    const slot = slots.find((s) => s.time === selectedSlot);
    return slot && slot.label !== 'Unavailable' && tables.length > 0 && !loading;
  }, [slots, selectedSlot, tables, loading]);

  const onContinue = () => {
    if (!continueEnabled) return;
    const picked = TIME_OPTIONS.find((t) => t.label === selectedSlot);
    const chosen = picked ? picked.value : time;
    const selectedTable = tables[0];
    if (!selectedTable) {
      setError('No tables available for the selected slot');
      return;
    }
    router.push({
      pathname: '/reservation/summary',
      params: {
        restaurantId,
        tableId: selectedTable._id,
        tableNumber: String(selectedTable.tableNumber),
        tableCapacity: String(selectedTable.capacity),
        date: toDateInput(date),
        time: chosen,
        guests: String(party),
      },
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make a Reservation</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.inputLabel}>Date</Text>
          <TouchableOpacity
            style={styles.inputBox}
            onPress={() => {
              if (Platform.OS === 'web') {
                setShowDatePicker((v) => !v);
              } else {
                setShowDatePicker((v) => !v);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.inputText}>{formatDateDisplay(date)}</Text>
            <Text style={styles.iconRight}>{'\u{1F4C5}'}</Text>
          </TouchableOpacity>
          {showDatePicker ? (
            <View style={styles.pickerSheet}>
              <input
                type="date"
                value={toDateInput(date)}
                min={toDateInput(new Date())}
                onChange={(e: any) => {
                  const v = e?.target?.value as string;
                  if (v) setDate(new Date(v + 'T00:00:00'));
                  setShowDatePicker(false);
                }}
                style={{ width: '100%', padding: SPACING.md, fontSize: FONT_SIZES.md }}
              />
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Time</Text>
          <TouchableOpacity
            style={styles.inputBox}
            onPress={() => setShowTimePicker((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.inputText}>
              {TIME_OPTIONS.find((t) => t.value === time)?.label ?? time}
            </Text>
            <Text style={styles.iconRight}>{'\u{2304}'}</Text>
          </TouchableOpacity>
          {showTimePicker ? (
            <View style={styles.pickerSheet}>
              {TIME_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.pickerItem,
                    time === t.value ? styles.pickerItemActive : null,
                  ]}
                  onPress={() => {
                    setTime(t.value);
                    setSelectedSlot(t.label);
                    setShowTimePicker(false);
                  }}
                >
                  <Text
                    style={time === t.value ? styles.pickerItemTextActive : styles.pickerItemText}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Party Size</Text>
          <TouchableOpacity
            style={styles.inputBox}
            onPress={() => setShowPartyPicker((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.inputLeftIconRow}>
              <Text style={styles.leftIcon}>{'\u{1F465}'}</Text>
              <Text style={styles.inputText}>{party} people</Text>
            </View>
            <Text style={styles.iconRight}>{'\u{2304}'}</Text>
          </TouchableOpacity>
          {showPartyPicker ? (
            <View style={styles.pickerSheet}>
              {PARTY_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.pickerItem,
                    party === n ? styles.pickerItemActive : null,
                  ]}
                  onPress={() => {
                    setParty(n);
                    setShowPartyPicker(false);
                  }}
                >
                  <Text
                    style={
                      party === n ? styles.pickerItemTextActive : styles.pickerItemText
                    }
                  >
                    {n} {n === 1 ? 'person' : 'people'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ height: SPACING.lg }} />
          <Text style={styles.sectionTitle}>Available Time Slots</Text>
          {checking ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {(slots.length > 0
                ? slots
                : [
                    { time: '6:00 PM', label: 'Limited' as const },
                    { time: '6:30 PM', label: 'Available' as const },
                    { time: '7:00 PM', label: 'Available' as const },
                    { time: '8:00 PM', label: 'Limited' as const },
                    { time: '8:30 PM', label: 'Unavailable' as const },
                    { time: '9:00 PM', label: 'Available' as const },
                  ]
              ).map((s) => {
                const unavailable = s.label === 'Unavailable';
                const limited = s.label === 'Limited';
                const selected = s.time === selectedSlot;
                return (
                  <TouchableOpacity
                    key={s.time}
                    disabled={unavailable}
                    onPress={() => {
                      setSelectedSlot(s.time);
                      const found = TIME_OPTIONS.find((t) => t.label === s.time);
                      if (found) setTime(found.value);
                    }}
                    style={[
                      styles.slotChip,
                      selected
                        ? styles.slotChipSelected
                        : unavailable
                        ? styles.slotChipUnavailable
                        : styles.slotChipIdle,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.slotTime,
                        selected
                          ? styles.slotTimeSelected
                          : unavailable
                          ? styles.slotTimeUnavailable
                          : styles.slotTimeIdle,
                      ]}
                    >
                      {s.time}
                    </Text>
                    <Text
                      style={[
                        styles.slotLabel,
                        limited
                          ? styles.slotLabelLimited
                          : unavailable
                          ? styles.slotLabelUnavailable
                          : selected
                          ? styles.slotLabelSelected
                          : styles.slotLabelAvailable,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: SPACING.xxl }} />
          <CustomButton
            title="Continue"
            variant="primary"
            onPress={onContinue}
            disabled={!continueEnabled}
            style={styles.continueButton}
          />
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
  },
  centerRow: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  inputLeftIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  inputText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
  },
  iconRight: {
    fontSize: 22,
    color: COLORS.primary,
  },
  pickerSheet: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemActive: {
    backgroundColor: COLORS.surface,
  },
  pickerItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  pickerItemTextActive: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  slotChip: {
    width: '30%',
    minWidth: 100,
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipIdle: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  slotChipSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  slotChipUnavailable: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    opacity: 0.6,
  },
  slotTime: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: 4,
  },
  slotTimeIdle: {
    color: COLORS.textPrimary,
  },
  slotTimeSelected: {
    color: COLORS.white,
  },
  slotTimeUnavailable: {
    color: COLORS.textLight,
  },
  slotLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  slotLabelLimited: {
    color: COLORS.error,
  },
  slotLabelUnavailable: {
    color: COLORS.textLight,
  },
  slotLabelSelected: {
    color: COLORS.white,
  },
  slotLabelAvailable: {
    color: COLORS.success,
  },
  continueButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
  },
});
