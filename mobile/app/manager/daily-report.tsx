import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ManagerShell,
  FeedbackBox,
  darkText,
  burgundy,
} from '../../src/components/manager/ManagerUI';
import { CustomerFlowChart } from '../../src/components/manager/Charts';
import {
  DownloadIcon,
  ClockIcon,
  TrendUpIcon,
  WarningIcon,
  CheckIcon,
} from '../../src/components/manager/ManagerIcons';
import {
  getDailyReportPreview,
  getReportById,
  generateAndSaveReport,
  downloadReportFile,
  StaffReportData,
} from '../../src/services/managerData';

export default function DailyReportScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const activeDate = params.date || new Date().toISOString().slice(0, 10);

  const [data, setData] = useState<StaffReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (params.id) {
        const res = await getReportById(params.id);
        setData(res);
      } else {
        const res = await getDailyReportPreview(activeDate);
        setData(res);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load daily report.');
    } finally {
      setLoading(false);
    }
  }, [params.id, activeDate]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleSaveOrDownload = async () => {
    setSaving(true);
    try {
      let current = data;
      if (!current?._id) {
        current = await generateAndSaveReport(data?.date || activeDate, 'Saved from Daily Report');
        setData(current);
      }
      if (current) {
        const downloaded = await downloadReportFile(current);
        if (downloaded) {
          setToast({
            type: 'success',
            text: `Report for ${current.dateLabel || current.date} saved and downloaded as CSV!`,
          });
        } else {
          setToast({
            type: 'success',
            text: `Report saved to Report History.`,
          });
        }
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        text: err?.response?.data?.error || err?.message || 'Failed to save or download report.',
      });
    } finally {
      setSaving(false);
    }
  };

  const headerAction = (
    <Pressable
      style={styles.downloadBtn}
      onPress={() => void handleSaveOrDownload()}
      disabled={saving}
      accessibilityRole="button"
      accessibilityLabel="Save and download report"
    >
      {saving ? (
        <ActivityIndicator size="small" color={burgundy} />
      ) : (
        <DownloadIcon size={20} color={burgundy} />
      )}
    </Pressable>
  );

  return (
    <ManagerShell
      title="Daily Report"
      tab="reports"
      headerAction={headerAction}
      onRefresh={loadData}
    >
      <FeedbackBox loading={loading && !data} error={error} retry={loadData} />

      {/* Floating Status Toast */}
      {toast && (
        <View style={[styles.toastBanner, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
          {toast.type === 'error' ? (
            <WarningIcon size={18} color="#B42318" />
          ) : (
            <CheckIcon size={18} color="#027A48" />
          )}
          <Text style={[styles.toastText, toast.type === 'error' ? styles.toastTextError : styles.toastTextSuccess]}>
            {toast.text}
          </Text>
        </View>
      )}

      {/* Date Subtitle */}
      <Text style={styles.dateCaption}>
        {data?.dateLabel || new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>

      {/* Customer Flow Multi-Line Chart with real dynamic flow data */}
      <CustomerFlowChart data={data?.customerFlow} />

      {/* Key Insights Card */}
      <View style={styles.insightsCard}>
        <Text style={styles.insightsTitle}>Key Insights</Text>

        <View style={styles.insightItem}>
          <ClockIcon size={18} color="#697386" />
          <Text style={styles.insightText}>
            Peak hour: <Text style={styles.boldText}>{data?.peakHour || '--'}</Text>
          </Text>
        </View>

        <View style={styles.insightItem}>
          <TrendUpIcon size={18} color="#0E9384" />
          <Text style={styles.insightText}>
            Highest wait time: <Text style={styles.boldText}>{data ? `${data.highestWaitTime} minutes` : '--'}</Text>
          </Text>
        </View>

        <View style={styles.insightItem}>
          <WarningIcon size={18} color="#F79009" />
          <Text style={styles.insightText}>
            Walkaways: <Text style={[styles.boldText, { color: burgundy }]}>{data ? `${data.walkawaysCount} parties (${data.walkawaysPercent}%)` : '--'}</Text>
          </Text>
        </View>

        <View style={styles.insightItem}>
          <TrendUpIcon size={18} color="#2E90FA" />
          <Text style={styles.insightText}>
            Overall occupancy: <Text style={styles.boldText}>{data ? `${data.overallOccupancy}%` : '--'}</Text>
          </Text>
        </View>
      </View>

      {/* Report History Link */}
      <Pressable
        style={styles.historyLinkRow}
        onPress={() => router.push('/manager/report-history')}
        accessibilityRole="button"
        accessibilityLabel="Go to Report History"
      >
        <Text style={styles.historyLinkText}>Report History</Text>
        <Text style={styles.historyChevron}>›</Text>
      </Pressable>
    </ManagerShell>
  );
}

const styles = StyleSheet.create({
  downloadBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateCaption: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#697386',
    marginVertical: 4,
  },
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
    gap: 14,
    marginTop: 8,
  },
  insightsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: darkText,
    marginBottom: 2,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#344054',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: darkText,
  },
  historyLinkRow: {
    marginTop: 24,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  historyLinkText: {
    fontSize: 18,
    fontWeight: '800',
    color: darkText,
  },
  historyChevron: {
    fontSize: 22,
    fontWeight: '600',
    color: burgundy,
    marginTop: -2,
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
});
