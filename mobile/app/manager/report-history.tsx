import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ManagerShell,
  FeedbackBox,
  EmptyState,
  burgundy,
  darkText,
} from '../../src/components/manager/ManagerUI';
import {
  CalendarIcon,
  DownloadIcon,
  TrashIcon,
} from '../../src/components/manager/ManagerIcons';
import {
  getReportHistory,
  deleteReport,
  StaffReportData,
} from '../../src/services/managerData';

export default function ReportHistoryScreen() {
  const [reports, setReports] = useState<StaffReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getReportHistory();
      setReports(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load report history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleDelete = (reportId: string, label: string) => {
    Alert.alert(
      'Delete Saved Report',
      `Are you sure you want to delete the report for ${label}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReport(reportId);
              setReports((prev) => prev.filter((r) => r._id !== reportId));
              Alert.alert('Deleted', 'Report was deleted from database.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || err?.message || 'Failed to delete report.');
            }
          },
        },
      ]
    );
  };

  return (
    <ManagerShell
      title="Report History"
      tab="reports"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !reports.length} error={error} retry={() => void loadData()} />

      {reports.length > 0 ? (
        <View style={styles.list}>
          {reports.map((item) => (
            <View key={item._id} style={styles.card}>
              <Pressable
                style={styles.cardLeft}
                onPress={() => router.push({ pathname: '/manager/daily-report', params: { id: item._id, date: item.date } })}
                accessibilityRole="button"
                accessibilityLabel={`View report for ${item.dateLabel || item.date}`}
              >
                <View style={styles.calendarBadge}>
                  <CalendarIcon size={20} color={burgundy} />
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.dateTitle}>{item.dateLabel || item.date}</Text>
                  <Text style={styles.metaSubtitle}>
                    Occ: {item.overallOccupancy}% · Wait: {item.avgWaitTime} min
                  </Text>
                </View>
              </Pressable>

              <View style={styles.cardActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/manager/daily-report', params: { id: item._id, date: item.date } })}
                  accessibilityRole="button"
                  accessibilityLabel="View report"
                >
                  <DownloadIcon size={18} color={burgundy} />
                </Pressable>
                {item._id && (
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item._id, item.dateLabel || item.date)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete saved report"
                  >
                    <TrashIcon size={18} color="#D92D4B" />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : !loading ? (
        <EmptyState
          title="No Saved Reports"
          detail="Generate and save an end of day report to view your history here."
        />
      ) : null}
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    marginTop: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  calendarBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FBECEE',
    borderWidth: 1,
    borderColor: '#F0CED5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaCol: {
    gap: 3,
    flex: 1,
  },
  dateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: darkText,
  },
  metaSubtitle: {
    fontSize: 12,
    color: '#697386',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FAFAFC',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FDF2F4',
  },
});
