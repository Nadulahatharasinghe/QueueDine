import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
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
  checkAvailability,
  getReservation,
  modifyReservation,
} from '../../src/services/reservationService';
import { Table, TimeSlot, Reservation } from '../../src/types';

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

const TIME_SLOT_LABELS: Record<string, string> = {
  '18:00': '6:00 PM',
  '18:30': '6:30 PM',
  '19:00': '7:00 PM',
  '20:00': '8:00 PM',
  '20:30': '8:30 PM',
  '21:00': '9:00 PM',
};

export default function EditReservationScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const reservationId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [updatedReservationId, setUpdatedReservationId] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);

  const [restaurantId, setRestaurantId] = useState<string>('');
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [time, setTime] = useState<string>('19:00');
  const [party, setParty] = useState<number>(2);
  const [selectedSlot, setSelectedSlot] = useState<string>('7:00 PM');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [specialRequests, setSpecialRequests] = useState<string>('');

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!reservationId) {
      setError('Reservation ID is required');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const r = await getReservation(reservationId);
        setReservation(r);
        const rid =
          typeof r.restaurantId === 'object' ? r.restaurantId._id : r.restaurantId;
        setRestaurantId(rid);
        const d = new Date(r.date + 'T00:00:00');
        setDate(d);
        setTime(r.time);
        setParty(r.guests);
        const label = TIME_SLOT_LABELS[r.time] || r.time;
        setSelectedSlot(label);
        if (r.specialRequests) setSpecialRequests(r.specialRequests);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load reservation');
      } finally {
        setLoading(false);
      }
    })();
  }, [reservationId]);

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

  const selectedTimeLabel = useMemo(
    () => TIME_SLOT_LABELS[time] || time,
    [time]
  );

  const saveEnabled = useMemo(() => {
    const slot = slots.find((s) => s.time === selectedSlot || s.time === selectedTimeLabel);
    const avail = slot ? slot.label !== 'Unavailable' : true;
    return (
      !loading &&
      !saving &&
      reservation != null &&
      avail &&
      (tables.length > 0 || reservation.status !== 'confirmed')
    );
  }, [slots, selectedSlot, selectedTimeLabel, tables, loading, saving, reservation]);

  const onSave = async () => {
    if (!saveEnabled || !reservationId || !reservation) return;
    const slot = slots.find((s) => s.time === selectedSlot);
    const chosen = TIME_OPTIONS.find((t) => t.label === selectedSlot)?.value || time;
    let picked: Table | undefined;
    if (tables.length > 0) {
      // Try to pick a suitable table
      picked = tables[0];
    } else {
      // Fallback: reuse original table
      const origTableId =
        typeof reservation.tableId === 'object'
          ? reservation.tableId._id
          : reservation.tableId;
      const allTables = await (async () => {
        try {
          const { getTables } = await import('../../src/services/restaurantService');
          return await getTables(restaurantId);
        } catch {
          return [];
        }
      })();
      picked = allTables.find((t) => t._id === origTableId);
    }
    const payload: any = {
      date: toDateInput(date),
      time: chosen,
      guests: party,
      specialRequests,
    };
    if (picked) payload.tableId = picked._id;
    try {
      setSaving(true);
      setError('');
      const updated = await modifyReservation(reservationId, payload);
      setUpdatedReservationId(updated._id);
      setShowSaveSuccess(true);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Failed to update reservation';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSaving(false);
    }
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

  if (!reservation || !restaurantId) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Reservation not found'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const restaurantName =
    typeof reservation.restaurantId === 'object'
      ? reservation.restaurantId.name
      : 'Restaurant';

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modify Reservation</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Restaurant</Text>
          <Text style={styles.infoValue}>{restaurantName}</Text>
        </View>

        <Text style={styles.inputLabel}>Date</Text>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => setShowDatePicker((v) => !v)}
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
                  style={
                    time === t.value ? styles.pickerItemTextActive : styles.pickerItemText}
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
                    party === n ? styles.pickerItemTextActive : styles.pickerItemText}
                >
                  {n} {n === 1 ? 'person' : 'people'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Special Requests (optional)</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          placeholder="Any special requests or notes..."
          placeholderTextColor={COLORS.textLight}
          value={specialRequests}
          onChangeText={setSpecialRequests}
        />

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
                  { time: '6:00 PM', label: 'Available' as const },
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

        {tables.length > 0 ? (
          <>
            <View style={{ height: SPACING.lg }} />
            <Text style={styles.sectionTitle}>Available Tables</Text>
            <View style={styles.tablesList}>
              {tables.slice(0, 3).map((t) => (
                <View key={t._id} style={styles.tableChip}>
                  <Text style={styles.tableChipText}>
                    #{t.tableNumber} — {t.capacity} pax
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ height: SPACING.xxl }} />
        <CustomButton
          title={saving ? 'Saving...' : 'Save Changes'}
          variant="primary"
          onPress={onSave}
          disabled={!saveEnabled}
          style={styles.saveButton}
        />
      </ScrollView>
      <AnimatedPopup
        visible={showSaveSuccess}
        title="Reservation Updated"
        message="Your reservation changes have been saved successfully."
        buttonText="View Reservation"
        onContinue={() => {
          setShowSaveSuccess(false);
          if (updatedReservationId) {
            router.replace({
              pathname: `/reservation/${updatedReservationId}` as any,
            });
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
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  infoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    ...SHADOWS.sm,
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
  slotTimeIdle: { color: COLORS.textPrimary },
  slotTimeSelected: { color: COLORS.white },
  slotTimeUnavailable: { color: COLORS.textLight },
  slotLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  slotLabelLimited: { color: COLORS.error },
  slotLabelUnavailable: { color: COLORS.textLight },
  slotLabelSelected: { color: COLORS.white },
  slotLabelAvailable: { color: COLORS.success },
  tablesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tableChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  tableChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  saveButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
  },
});
