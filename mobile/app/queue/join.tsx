import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { joinQueue } from '../../src/services/queueService';
import {
  getFirstRestaurant,
  getQueueStats,
} from '../../src/services/restaurantService';

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

export default function JoinQueueScreen() {
  const params = useLocalSearchParams<{ restaurantId?: string }>();
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [party, setParty] = useState<number>(4);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(25);
  const [partiesAhead, setPartiesAhead] = useState<number>(12);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let rid = params.restaurantId;
        if (!rid) {
          const r = await getFirstRestaurant();
          if (r) rid = r._id;
        }
        if (rid) {
          setRestaurantId(rid);
          try {
            const stats = await getQueueStats(rid);
            if (stats.estimatedWaitTime && stats.estimatedWaitTime > 0) {
              setEstimatedMinutes(Math.max(1, stats.estimatedWaitTime));
            }
            if (typeof stats.partiesAhead === 'number') {
              setPartiesAhead(stats.partiesAhead);
            }
          } catch {
            // ignore
          }
        }
        try {
          const userStr = await AsyncStorage.getItem('user');
          if (userStr) {
            const u = JSON.parse(userStr);
            if (u.fullName) setFullName(u.fullName);
            if (u.phone) setMobile(u.phone);
          }
        } catch {
          // ignore
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [params.restaurantId]);

  const onJoin = async () => {
    try {
      setError('');
      if (!restaurantId) {
        setError('Restaurant not loaded yet');
        return;
      }
      if (party < 1) {
        setError('Please select a valid party size');
        return;
      }
      if (!fullName.trim()) {
        setError('Please enter your full name');
        return;
      }
      setJoining(true);
      const entry = await joinQueue({
        restaurantId,
        guests: party,
        specialRequests: specialRequests.trim() || undefined,
      });
      router.replace({
        pathname: '/queue/ticket',
        params: { id: entry._id },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to join queue';
      setError(msg);
      Alert.alert('Could not join queue', msg);
    } finally {
      setJoining(false);
    }
  };

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Virtual Queue</Text>
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
          <Text style={styles.subTitle}>
            We&apos;ll notify you when your table is almost ready. You don&apos;t need to wait at the restaurant.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ height: SPACING.lg }} />

          <Text style={styles.fieldLabelSmall}>PARTY SIZE</Text>
          <TouchableOpacity
            style={styles.fieldBox}
            onPress={() => setShowPartyPicker((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.fieldLeft}>
              <Text style={styles.fieldIcon}>{'\u{1F465}'}</Text>
              <View>
                <Text style={styles.fieldPlaceholder}>PARTY SIZE</Text>
                <Text style={styles.fieldValue}>{party} people</Text>
              </View>
            </View>
            <View style={styles.fieldRightIcons}>
              <Text style={styles.fieldRightIcon}>{'\u{2304}'}</Text>
              <Text style={[styles.fieldRightIcon, { marginLeft: SPACING.sm }]}>{'\u{2304}'}</Text>
            </View>
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

          <Text style={styles.fieldLabelSmall}>FULL NAME</Text>
          <View style={styles.fieldBox}>
            <View style={styles.fieldLeft}>
              <Text style={styles.fieldIcon}>{'\u{1F464}'}</Text>
              <View style={{ flex: 1, paddingRight: SPACING.md }}>
                <Text style={styles.fieldPlaceholder}>FULL NAME</Text>
                <TextInput
                  style={styles.fieldValueInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholderTextColor={COLORS.textLight}
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabelSmall}>MOBILE NUMBER</Text>
          <View style={styles.fieldBox}>
            <View style={styles.fieldLeft}>
              <Text style={styles.fieldIcon}>{'\u{1F4F1}'}</Text>
              <View style={{ flex: 1, paddingRight: SPACING.md }}>
                <Text style={styles.fieldPlaceholder}>MOBILE NUMBER</Text>
                <TextInput
                  style={styles.fieldValueInput}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="+94 77 123 4567"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabelSmall}>SPECIAL REQUESTS (OPTIONAL)</Text>
          <View style={[styles.fieldBox, { minHeight: 80 }]}>
            <View style={styles.fieldLeftTop}>
              <Text style={styles.fieldIcon}>{'\u{1F4DD}'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldPlaceholder}>SPECIAL REQUESTS (OPTIONAL)</Text>
                <TextInput
                  style={[styles.fieldValueInput, { minHeight: 32 }]}
                  value={specialRequests}
                  onChangeText={setSpecialRequests}
                  placeholder="Window table if possible"
                  placeholderTextColor={COLORS.textLight}
                  autoCorrect={true}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          </View>

          <View style={{ height: SPACING.lg }} />
          <View style={styles.estimateCard}>
            <View style={styles.estimateClock}>
              <Text style={styles.estimateClockHand}>{'\u{23F0}'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.estimateLabel}>Estimated Wait Time</Text>
              <Text style={styles.estimateValue}>
                ~ {estimatedMinutes || 25} minutes
              </Text>
              <Text style={styles.estimateSub}>
                {partiesAhead || 12} parties ahead
              </Text>
            </View>
          </View>

          <View style={{ height: SPACING.xxl }} />
          <CustomButton
            title={joining ? 'Joining...' : 'Join Queue'}
            variant="primary"
            loading={joining}
            disabled={joining || !restaurantId}
            onPress={onJoin}
            style={styles.joinButton}
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
  subTitle: {
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  fieldLabelSmall: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    fontWeight: FONT_WEIGHTS.medium,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
    letterSpacing: 1,
  },
  fieldBox: {
    minHeight: 72,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.sm,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fieldLeftTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingTop: SPACING.xs,
  },
  fieldIcon: {
    fontSize: 22,
    width: 28,
    marginRight: SPACING.sm,
    color: COLORS.textSecondary,
  },
  fieldPlaceholder: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginBottom: 2,
    letterSpacing: 1,
  },
  fieldValue: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  fieldValueInput: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.medium,
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  fieldRightIcons: {
    flexDirection: 'row',
  },
  fieldRightIcon: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  pickerSheet: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
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
  estimateCard: {
    minHeight: 92,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    backgroundColor: 'rgba(16,185,129,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  estimateClock: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  estimateClockHand: {
    fontSize: 28,
    color: COLORS.white,
  },
  estimateLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  estimateValue: {
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  estimateSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  joinButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.xl,
  },
});
