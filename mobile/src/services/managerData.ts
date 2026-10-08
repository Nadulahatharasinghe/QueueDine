import { Platform, Share } from 'react-native';
import { staffApi } from './staffAuth';
import { StaffTable, Party } from './staffData';

export interface ManagerMetric {
  value: number | string;
  unit?: string;
  delta?: string;
  isPositive?: boolean;
}

export interface ManagerDashboardData {
  date: string;
  dateLabel: string;
  restaurant: { _id: string; name: string; location: string };
  user: { fullName: string; staffId: string; role: string };
  keyMetrics: {
    occupancy: ManagerMetric;
    waiting: ManagerMetric;
    availableTables: ManagerMetric;
    avgWaitTime: ManagerMetric;
    walkaways: ManagerMetric;
    noShows: ManagerMetric;
  };
  occupancyTrend: {
    peakLabel: string;
    data: { hour: string; value: number; isPeak?: boolean }[];
  };
  tablesSummary: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
  };
}

export interface LiveOperationsData {
  tables: StaffTable[];
  queueParties: Party[];
}

export interface OccupancyAnalyticsData {
  range: string;
  rangeLabel: string;
  avgOccupancy: ManagerMetric;
  avgTableTurnover: ManagerMetric;
  occupancyByHour: { day: string; value: number; label: string; isPeak?: boolean; peakValue?: string }[];
  tableUtilization: {
    centerPercentage: string;
    segments: { label: string; percent: number; color: string }[];
  };
}

export interface QueueAnalyticsData {
  range: string;
  rangeLabel: string;
  totalQueued: ManagerMetric;
  avgWaitTime: ManagerMetric;
  queueVolumeByHour: { hour: string; value: number; isPeak?: boolean; tooltip?: string }[];
  waitTimeDistribution: { label: string; percent: number }[];
}

export interface WalkawaysAnalyticsData {
  range: string;
  rangeLabel: string;
  walkaways: { count: number; rate: string; delta: string; isPositive: boolean };
  noShows: { count: number; rate: string; delta: string; isPositive: boolean };
  walkawaysByHour: { hour: string; value: number; isPeak?: boolean; tooltip?: string }[];
  noShowsByReservationTime: { hour: string; value: number }[];
}

export interface StaffReportData {
  _id: string;
  restaurantId: string;
  date: string;
  dateLabel: string;
  totalReservations: number;
  walkIns: number;
  customersSeated: number;
  avgWaitTime: number;
  noShowsCount: number;
  noShowsPercent: number;
  walkawaysCount: number;
  walkawaysPercent: number;
  peakHour: string;
  highestWaitTime: number;
  overallOccupancy: number;
  customerFlow: { hour: string; reservations: number; walkIns: number; seated: number }[];
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  generatedAt?: string;
}

export interface ManagerNotificationItem {
  _id: string;
  message: string;
  category: 'Queue' | 'Reservations' | 'System';
  createdAt: string;
  read: boolean;
}

// API methods
export const getManagerDashboard = async (dateOrRange?: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (dateOrRange) params.append('range', dateOrRange);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const q = params.toString();
  return (await staffApi.get<ManagerDashboardData>(`/api/manager/dashboard${q ? `?${q}` : ''}`)).data;
};

export const getLiveOverview = async () =>
  (await staffApi.get<LiveOperationsData>('/api/manager/live-overview')).data;

export const getOccupancyAnalytics = async (range?: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (range) params.append('range', range);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const q = params.toString();
  return (await staffApi.get<OccupancyAnalyticsData>(`/api/manager/analytics/occupancy${q ? `?${q}` : ''}`)).data;
};

export const getQueueAnalytics = async (range?: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (range) params.append('range', range);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const q = params.toString();
  return (await staffApi.get<QueueAnalyticsData>(`/api/manager/analytics/queue${q ? `?${q}` : ''}`)).data;
};

export const getWalkawaysAnalytics = async (range?: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (range) params.append('range', range);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const q = params.toString();
  return (await staffApi.get<WalkawaysAnalyticsData>(`/api/manager/analytics/walkaways${q ? `?${q}` : ''}`)).data;
};

export const getManagerReservations = async (tab: 'upcoming' | 'past' = 'upcoming', date?: string) =>
  (await staffApi.get<Party[]>(`/api/manager/reservations?tab=${tab}${date ? `&date=${encodeURIComponent(date)}` : ''}`)).data;

export const getDailyReportPreview = async (date: string) =>
  (await staffApi.get<StaffReportData>(`/api/manager/reports/daily?date=${encodeURIComponent(date)}`)).data;

export const generateAndSaveReport = async (date: string, notes?: string) =>
  (await staffApi.post<StaffReportData>('/api/manager/reports', { date, notes })).data;

export const getReportHistory = async () =>
  (await staffApi.get<StaffReportData[]>('/api/manager/reports')).data;

export const getReportById = async (id: string) =>
  (await staffApi.get<StaffReportData>(`/api/manager/reports/${encodeURIComponent(id)}`)).data;

export const deleteReport = async (id: string) =>
  (await staffApi.delete(`/api/manager/reports/${encodeURIComponent(id)}`)).data;

export const updateReportNotes = async (id: string, notes: string) =>
  (await staffApi.patch<StaffReportData>(`/api/manager/reports/${encodeURIComponent(id)}`, { notes })).data;

export function generateReportCsv(report: StaffReportData): string {
  const lines: string[] = [];
  lines.push('QueueDine End-of-Day Operations Report');
  lines.push(`Date,${report.date}`);
  lines.push(`Date Label,"${report.dateLabel || report.date}"`);
  lines.push(`Generated At,"${report.generatedAt || new Date().toISOString()}"`);
  lines.push('');
  lines.push('Metric,Value');
  lines.push(`Total Reservations,${report.totalReservations ?? 0}`);
  lines.push(`Walk-ins,${report.walkIns ?? 0}`);
  lines.push(`Customers Seated,${report.customersSeated ?? 0}`);
  lines.push(`Average Wait Time (mins),${report.avgWaitTime ?? 0}`);
  lines.push(`No-shows,${report.noShowsCount ?? 0} (${report.noShowsPercent ?? 0}%)`);
  lines.push(`Walkaways,${report.walkawaysCount ?? 0} (${report.walkawaysPercent ?? 0}%)`);
  lines.push(`Overall Occupancy,${report.overallOccupancy ?? 0}%`);
  lines.push(`Peak Hour,"${report.peakHour || 'N/A'}"`);
  lines.push(`Highest Wait Time (mins),${report.highestWaitTime ?? 0}`);
  lines.push(`Notes,"${(report.notes || '').replace(/"/g, '""')}"`);
  lines.push('');
  lines.push('Hourly Customer Flow');
  lines.push('Time,Reservations,Walk-ins,Seated');
  if (Array.isArray(report.customerFlow)) {
    for (const item of report.customerFlow) {
      const cf = item as Record<string, any>;
      const timeStr = cf.hour || cf.time || '';
      const r = cf.reservations ?? cf.waitlist ?? 0;
      const w = cf.walkIns ?? 0;
      const s = cf.seated ?? 0;
      lines.push(`"${timeStr}",${r},${w},${s}`);
    }
  }
  return lines.join('\r\n');
}

export async function downloadReportFile(report: StaffReportData): Promise<boolean> {
  try {
    const csvContent = generateReportCsv(report);
    const fileName = `QueueDine_Report_${report.date}.csv`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return true;
      }
    }

    // Native mobile: Share sheet
    await Share.share({
      title: `QueueDine Report ${report.dateLabel || report.date}`,
      message: csvContent,
    });
    return true;
  } catch (err) {
    console.error('Error downloading/sharing report:', err);
    return false;
  }
}

export const getManagerNotifications = async (category?: string) =>
  (await staffApi.get<ManagerNotificationItem[]>(`/api/manager/notifications${category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''}`)).data;

export const markNotificationRead = async (id: string) =>
  (await staffApi.patch(`/api/manager/notifications/${encodeURIComponent(id)}/read`, {})).data;

export interface ManagerProfileDetails {
  _id: string;
  staffId: string;
  fullName: string;
  email: string;
  role: string;
  restaurantId: string;
  restaurantName?: string;
  restaurantLocation?: string;
  onDuty?: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  createdAt?: string;
}

export const getManagerProfile = async () =>
  (await staffApi.get<ManagerProfileDetails>('/api/manager/profile')).data;

export const updateManagerProfile = async (data: { fullName?: string; email?: string }) =>
  (await staffApi.patch<ManagerProfileDetails>('/api/manager/profile', data)).data;

export const changeManagerPassword = async (data: { currentPassword: string; newPassword: string }) =>
  (await staffApi.post<{ success: boolean; message: string }>('/api/manager/change-password', data)).data;

