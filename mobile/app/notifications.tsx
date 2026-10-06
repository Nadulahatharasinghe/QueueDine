import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../src/constants/theme';
import ScreenContainer from '../src/components/ScreenContainer';
import CustomButton from '../src/components/CustomButton';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../src/services/notificationService';
import { NotificationItem } from '../src/types';

const iconFor = (type: string) => {
  if (type.startsWith('reservation_')) return '📅';
  if (type.startsWith('queue_')) return '🧾';
  if (type === 'system') return 'ℹ️';
  return '🔔';
};

const formatRelative = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const resp = await getNotifications();
      setNotifications(resp.notifications || []);
      setUnreadCount(resp.unreadCount ?? 0);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const handlePress = async (n: NotificationItem) => {
    try {
      if (!n.isRead) {
        await markAsRead(n._id);
        setNotifications(prev =>
          prev.map(x =>
            x._id === n._id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x,
          ),
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (_) {
      // ignore; still try navigation
    }
    if (n.relatedType === 'reservation' && n.relatedId) {
      router.push(`/reservation/${n.relatedId}`);
    } else if (n.relatedType === 'queue' && n.relatedId) {
      router.push(`/queue/${n.relatedId}`);
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllAsRead();
      setNotifications(prev =>
        prev.map(x => (x.isRead ? x : { ...x, isRead: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const renderItem = (n: NotificationItem) => (
    <TouchableOpacity
      key={n._id}
      style={[
        styles.item,
        !n.isRead ? styles.itemUnread : null,
      ]}
      onPress={() => handlePress(n)}
      activeOpacity={0.7}
    >
      <View style={styles.leftColumn}>
        {!n.isRead ? <View style={styles.unreadIndicator} /> : <View style={styles.unreadPlaceholder} />}
        <View style={styles.itemIconWrap}>
          <Text style={styles.itemIcon}>{iconFor(n.type)}</Text>
        </View>
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemTopRow}>
          <Text
            style={[
              styles.itemTitle,
              !n.isRead ? styles.itemTitleUnread : null,
            ]}
            numberOfLines={1}
          >
            {n.title}
          </Text>
          <Text style={styles.itemTime}>{formatRelative(n.createdAt)}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={3}>
          {n.message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Notifications' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        <CustomButton
          title={markingAll ? 'Marking...' : 'Mark all read'}
          variant="outline"
          disabled={unreadCount === 0 || markingAll}
          onPress={handleMarkAll}
          style={styles.markAllBtn}
        />
      </View>

      {error && notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <CustomButton title="Retry" onPress={() => load()} style={{ marginTop: SPACING.lg }} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>
            Updates about your reservations and queue will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          {notifications.map(renderItem)}
          {!!error && (
            <Text style={[styles.errorText, { paddingHorizontal: SPACING.md, marginTop: SPACING.md }]}>
              {error}
            </Text>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.bold,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  markAllBtn: {
    minWidth: 110,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  itemUnread: {
    backgroundColor: 'rgba(139, 0, 0, 0.04)',
    borderColor: 'rgba(139, 0, 0, 0.25)',
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemBody: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  itemTitleUnread: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  itemTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  itemMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  leftColumn: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  unreadPlaceholder: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginBottom: SPACING.xs,
  },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
