import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
import { getQueueStatus } from '../../src/services/queueService';
import { QueueEntry } from '../../src/types';

const confettiDots = [
  { top: 0, left: 60, color: COLORS.primary, size: 10 },
  { top: 30, left: 20, color: '#FFD700', size: 8 },
  { top: 10, left: 100, color: COLORS.success, size: 9 },
  { top: 40, left: 140, color: COLORS.secondary, size: 7 },
  { top: 60, left: 50, color: COLORS.secondary, size: 8 },
  { top: 70, left: 110, color: COLORS.info, size: 9 },
  { top: 20, left: 150, color: COLORS.primary, size: 6 },
  { top: 80, left: 20, color: COLORS.success, size: 7 },
];

const formatJoinedTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: undefined,
      day: undefined,
      month: undefined,
      year: undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function QueueTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [partiesAhead, setPartiesAhead] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const status = await getQueueStatus(id);
        setEntry(status.entry);
        setPartiesAhead(status.partiesAhead);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load queue ticket');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!entry) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Ticket not found'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const restaurant =
    typeof entry.restaurantId === 'object' ? entry.restaurantId : null;
  const qNum = String(entry.queueNumber).padStart(3, '0');

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      >
        <View style={styles.celebrateWrap}>
          <View style={styles.confettiBox}>
            {confettiDots.map((d, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: d.top,
                  left: d.left,
                  width: d.size,
                  height: d.size,
                  borderRadius: d.size / 2,
                  backgroundColor: d.color,
                }}
              />
            ))}
            <View style={styles.checkCircle}>
              <Text style={styles.checkMark}>{'\u2713'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>You&apos;re in the Queue!</Text>
        <Text style={styles.qLabel}>Queue Number</Text>
        <Text style={styles.qNumber}>Q-{qNum}</Text>

        <View style={{ height: SPACING.lg }} />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowIcon}>{'\u{1F37D}'}</Text>
              <Text style={styles.rowLabel}>Restaurant</Text>
            </View>
            <Text style={styles.rowValue}>{restaurant?.name || 'Restaurant'}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowIcon}>{'\u{1F465}'}</Text>
              <Text style={styles.rowLabel}>Party Size</Text>
            </View>
            <Text style={styles.rowValue}>{entry.guests} people</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowIcon}>{'\u{1F552}'}</Text>
              <Text style={styles.rowLabel}>Joined Time</Text>
            </View>
            <Text style={styles.rowValue}>Today, {formatJoinedTime(entry.joinedAt)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowIcon}>{'\u{1F4D6}'}</Text>
              <Text style={styles.rowLabel}>Estimated Wait</Text>
            </View>
            <Text style={styles.rowWaitGreen}>
              ~ {entry.estimatedWaitTime || 25} minutes
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowIcon}>{'\u{1F4CD}'}</Text>
              <Text style={styles.rowLabel}>Parties Ahead</Text>
            </View>
            <Text style={styles.rowValue}>{partiesAhead}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          We&apos;ll notify you as your table gets closer. You don&apos;t need to wait at the restaurant.
        </Text>

        <View style={{ height: SPACING.xl }} />
        <CustomButton
          title="Track My Queue"
          variant="primary"
          onPress={() =>
            router.replace({
              pathname: '/queue/[id]',
              params: { id: entry._id },
            })
          }
          style={styles.trackButton}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
  },
  celebrateWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  confettiBox: {
    position: 'relative',
    width: 180,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.success,
    borderWidth: 6,
    borderColor: 'rgba(16,185,129,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
  },
  checkMark: {
    fontSize: 56,
    color: COLORS.white,
    fontWeight: FONT_WEIGHTS.bold,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  qLabel: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  qNumber: {
    fontSize: 72,
    lineHeight: 76,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.md,
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
  rowLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
    color: COLORS.primary,
  },
  rowLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    maxWidth: '55%',
    textAlign: 'right',
  },
  rowWaitGreen: {
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.success,
  },
  note: {
    marginTop: SPACING.lg,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  trackButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
  },
});
