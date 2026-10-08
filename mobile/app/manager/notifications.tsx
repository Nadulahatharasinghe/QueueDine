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
import {
  WarningIcon,
  ClockIcon,
  TableOutlineIcon,
  CheckIcon,
  BellIcon,
} from '../../src/components/manager/ManagerIcons';
import {
  getManagerNotifications,
  markNotificationRead,
  ManagerNotificationItem,
} from '../../src/services/managerData';

export default function ManagerNotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState<'All' | 'Operations' | 'System'>('All');
  const [notifications, setNotifications] = useState<ManagerNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getManagerNotifications(activeFilter);
      setNotifications(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleToggleRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Ignore
    }
  };

  const getNotificationIcon = (title: string, category: string) => {
    const lower = `${title} ${category}`.toLowerCase();
    if (lower.includes('high queue') || lower.includes('alert') || lower.includes('urgent')) {
      return {
        bg: '#FEE4E2',
        component: <WarningIcon size={18} color="#D92D4B" />,
      };
    }
    if (lower.includes('walkaway') || lower.includes('wait time') || lower.includes('time')) {
      return {
        bg: '#FEF0C7',
        component: <ClockIcon size={18} color="#B54708" />,
      };
    }
    if (lower.includes('table') || lower.includes('seated') || lower.includes('floor')) {
      return {
        bg: '#E0F2FE',
        component: <TableOutlineIcon size={18} color="#026AA2" />,
      };
    }
    if (lower.includes('report') || lower.includes('completed') || lower.includes('success')) {
      return {
        bg: '#D1FADF',
        component: <CheckIcon size={18} color="#0E9384" />,
      };
    }
    return {
      bg: '#FBECEE',
      component: <BellIcon size={18} color={burgundy} />,
    };
  };

  const formatNotifTime = (createdAt?: string) => {
    if (!createdAt) return 'Just now';
    const diffMs = Date.now() - new Date(createdAt).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Just now';
    const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} h ago`;
    return `${Math.round(diffHours / 24)} d ago`;
  };

  const filteredItems = notifications.filter((item) => {
    if (activeFilter === 'Operations') return item.category === 'Queue' || item.category === 'Reservations';
    if (activeFilter === 'System') return item.category === 'System';
    return true;
  });

  return (
    <ManagerShell
      title="Notifications"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox
        loading={loading && !notifications.length}
        error={error}
        retry={() => void loadData()}
      />

      {/* Filter Chips: All | Operations | System */}
      <View style={styles.chipsRow}>
        {(['All', 'Operations', 'System'] as const).map((filter) => {
          const isSelected = activeFilter === filter;
          return (
            <Pressable
              key={filter}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => setActiveFilter(filter)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {filter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Notification Items List */}
      {filteredItems.length > 0 ? (
        <View style={styles.list}>
          {filteredItems.map((item) => {
            const parts = item.message.split(' - ');
            const title = parts[0] || item.message;
            const desc = parts[1] || 'Operational update';
            const iconBadge = getNotificationIcon(title, item.category);

            return (
              <Pressable
                key={item._id}
                style={[styles.notifRow, item.read && styles.notifRowRead]}
                onPress={() => handleToggleRead(item._id)}
              >
                <View style={[styles.iconCircle, { backgroundColor: iconBadge.bg }]}>
                  {iconBadge.component}
                </View>

                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, item.read && styles.notifTitleRead]}>
                    {title}
                  </Text>
                  <Text style={styles.notifDesc}>{desc}</Text>
                </View>

                <Text style={styles.notifTime}>{formatNotifTime(item.createdAt)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : !loading ? (
        <EmptyState
          title="No Notifications"
          detail={`You have no notifications in the ${activeFilter} category.`}
        />
      ) : null}
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  chipActive: {
    backgroundColor: burgundy,
    borderColor: burgundy,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#344054',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
    gap: 14,
  },
  notifRowRead: {
    opacity: 0.65,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    gap: 3,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: darkText,
  },
  notifTitleRead: {
    fontWeight: '500',
    color: '#475467',
  },
  notifDesc: {
    fontSize: 12,
    color: '#697386',
  },
  notifTime: {
    fontSize: 11,
    color: '#98A2B3',
  },
});
