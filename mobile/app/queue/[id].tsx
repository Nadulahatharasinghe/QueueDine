import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
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
import { cancelQueue, getQueueStatus } from '../../src/services/queueService';
import { QueueEntry } from '../../src/types';

type S = {
  entry: QueueEntry | null;
  partiesAhead: number;
  currentCalled: number | null;
};

const formatJoinedTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'waiting':
      return COLORS.warning;
    case 'called':
      return COLORS.info;
    case 'seated':
      return COLORS.success;
    case 'cancelled':
      return COLORS.error;
    default:
      return COLORS.textLight;
  }
};

export default function QueueStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<S>({
    entry: null,
    partiesAhead: 0,
    currentCalled: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getQueueStatus(id);
      setState({
        entry: s.entry,
        partiesAhead: s.partiesAhead,
        currentCalled: s.currentCalledQueueNumber,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load queue status');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    timerRef.current = setInterval(() => {
      void load();
    }, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

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

  const onCancel = () => {
    Alert.alert('Leave Queue', 'Are you sure you want to leave the queue?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancelling(true);
            await cancelQueue(id);
            Alert.alert('Left Queue', 'You have left the queue.');
            router.replace('/home');
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to leave queue');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
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

  if (!state.entry) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Queue status not found'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const entry = state.entry;
  const restaurant = typeof entry.restaurantId === 'object' ? entry.restaurantId : null;
  const waiting = entry.status === 'waiting';

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track My Queue</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.positionCard}>
          <Text style={styles.qBig}>Q-{String(entry.queueNumber).padStart(3, '0')}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusColor(entry.status) },
              ]}
            />
            <Text style={[styles.statusText, { color: statusColor(entry.status) }]}>
              {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
            </Text>
          </View>

          <View style={styles.positionRow}>
            <View style={styles.positionCell}>
              <Text style={styles.positionValue}>{entry.position}</Text>
              <Text style={styles.positionLabel}>Your Position</Text>
            </View>
            <View style={styles.positionDivider} />
            <View style={styles.positionCell}>
              <Text style={styles.positionValue}>{state.partiesAhead}</Text>
              <Text style={styles.positionLabel}>Parties Ahead</Text>
            </View>
            <View style={styles.positionDivider} />
            <View style={styles.positionCell}>
              <Text style={styles.positionValueWait}>
                ~{entry.estimatedWaitTime || 25}m
              </Text>
              <Text style={styles.positionLabel}>Est. Wait</Text>
            </View>
          </View>
        </View>

        {state.currentCalled ? (
          <View style={styles.nowCallingCard}>
            <Text style={styles.nowCallingLabel}>Now Calling</Text>
            <Text style={styles.nowCallingValue}>
              Q-{String(state.currentCalled).padStart(3, '0')}
            </Text>
          </View>
        ) : null}

        <View style={{ height: SPACING.lg }} />
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Restaurant</Text>
            <Text style={styles.rowValue}>{restaurant?.name || 'Restaurant'}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Party Size</Text>
            <Text style={styles.rowValue}>{entry.guests} people</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Joined At</Text>
            <Text style={styles.rowValue}>{formatJoinedTime(entry.joinedAt)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Queue Number</Text>
            <Text style={[styles.rowValue, { color: COLORS.primary }]}>
              Q-{String(entry.queueNumber).padStart(3, '0')}
            </Text>
          </View>
        </View>

        <View style={{ height: SPACING.xxl }} />
        <CustomButton
          title={cancelling ? 'Leaving...' : 'Leave Queue'}
          variant="primary"
          disabled={!waiting || cancelling}
          onPress={onCancel}
          style={[
            styles.leaveButton,
            !waiting ? { backgroundColor: COLORS.surface, borderColor: COLORS.border } : undefined,
          ]}
          textStyle={waiting ? { color: COLORS.white } : { color: COLORS.textLight }}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
  },
  positionCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  qBig: {
    fontSize: 56,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  positionRow: {
    width: '100%',
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  positionCell: {
    flex: 1,
    alignItems: 'center',
  },
  positionValue: {
    fontSize: 28,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  positionValueWait: {
    fontSize: 28,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.success,
  },
  positionLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  positionDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  nowCallingCard: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '50',
    backgroundColor: COLORS.primary + '10',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nowCallingLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  nowCallingValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 1,
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
  rowLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
  },
  leaveButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});
