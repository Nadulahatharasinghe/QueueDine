import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
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
  CheckIcon,
  WarningIcon,
} from '../../src/components/manager/ManagerIcons';
import {
  getReportHistory,
  deleteReport,
  downloadReportFile,
  StaffReportData,
} from '../../src/services/managerData';

export default function ReportHistoryScreen() {
  const [reports, setReports] = useState<StaffReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Floating notification toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const handleDownload = async (item: StaffReportData) => {
    const id = item._id || item.date;
    setDownloadingId(id);
    try {
      const success = await downloadReportFile(item);
      if (success) {
        setToast({
          type: 'success',
          text: `Report for ${item.dateLabel || item.date} downloaded successfully.`,
        });
      } else {
        setToast({
          type: 'error',
          text: 'Could not export report file.',
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        text: err?.message || 'Failed to download report.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteReport(deleteTarget.id);
      setReports((prev) => prev.filter((r) => r._id !== deleteTarget.id));
      setToast({
        type: 'success',
        text: `Report for ${deleteTarget.label} deleted successfully.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setToast({
        type: 'error',
        text: err?.response?.data?.error || err?.message || 'Failed to delete report.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ManagerShell
      title="Report History"
      tab="reports"
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
    >
      <FeedbackBox loading={loading && !reports.length} error={error} retry={() => void loadData()} />

      {/* Floating Status Toast Banner */}
      {toast && (
        <View style={[styles.toastBanner, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
          <View style={styles.toastIconBox}>
            {toast.type === 'error' ? (
              <WarningIcon size={18} color="#B42318" />
            ) : (
              <CheckIcon size={18} color="#027A48" />
            )}
          </View>
          <Text style={[styles.toastText, toast.type === 'error' ? styles.toastTextError : styles.toastTextSuccess]}>
            {toast.text}
          </Text>
        </View>
      )}

      {reports.length > 0 ? (
        <View style={styles.list}>
          {reports.map((item) => {
            const isThisDownloading = downloadingId === (item._id || item.date);
            return (
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
                  {/* Real Download CSV Button */}
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => void handleDownload(item)}
                    disabled={isThisDownloading}
                    accessibilityRole="button"
                    accessibilityLabel={`Download CSV for ${item.dateLabel || item.date}`}
                  >
                    {isThisDownloading ? (
                      <ActivityIndicator size="small" color={burgundy} />
                    ) : (
                      <DownloadIcon size={18} color={burgundy} />
                    )}
                  </Pressable>

                  {/* Real Delete with Cross-Platform Modal */}
                  {item._id && (
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => setDeleteTarget({ id: item._id!, label: item.dateLabel || item.date })}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete report for ${item.dateLabel || item.date}`}
                    >
                      <TrashIcon size={18} color="#D92D4B" />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : !loading ? (
        <EmptyState
          title="No Saved Reports"
          detail="Generate and save an end of day report to view your history here."
        />
      ) : null}

      {/* Delete Confirmation Modal (Cross-Platform) */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalBadge}>
              <TrashIcon size={24} color="#D92D4B" />
            </View>

            <Text style={styles.modalTitle}>Delete Saved Report</Text>
            <Text style={styles.modalDescription}>
              Are you sure you want to delete the report for{' '}
              <Text style={styles.modalBoldText}>{deleteTarget?.label}</Text>? This cannot be undone.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setDeleteTarget(null)}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="Cancel report deletion"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalDeleteBtn, isDeleting && styles.btnDisabled]}
                onPress={() => void confirmDelete()}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="Confirm report deletion"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    marginTop: 6,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    gap: 10,
  },
  toastSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A6F4C5',
  },
  toastError: {
    backgroundColor: '#FEF3F2',
    borderColor: '#FECDCA',
  },
  toastIconBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  toastTextSuccess: {
    color: '#027A48',
  },
  toastTextError: {
    color: '#B42318',
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
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FAFAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#F8D7DA',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
  },
  modalBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE4E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: darkText,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#475467',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalBoldText: {
    fontWeight: '700',
    color: darkText,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D92D4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
