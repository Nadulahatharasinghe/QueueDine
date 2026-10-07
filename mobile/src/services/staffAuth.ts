import { create } from 'axios';
import { useSyncExternalStore } from 'react';

export interface StaffProfile {
  _id: string;
  fullName: string;
  role: 'host' | 'staff' | 'manager';
  restaurantId: string;
  staffId: string;
  email: string;
  onDuty: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  settings?: { queueAlerts: boolean; reservationAlerts: boolean };
}
let currentStaff: StaffProfile | null = null;
const listeners = new Set<() => void>();
export function updateStaff(user: StaffProfile | null) {
  currentStaff = user;
  if (!user) delete staffApi.defaults.headers.common.Authorization;
  listeners.forEach(listener => listener());
}
export function useStaffSession() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => currentStaff, () => null);
}

function staffBaseURL() {
  const configured = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
  const browserHost = typeof window !== 'undefined' ? window.location?.hostname : undefined;
  if (browserHost !== 'localhost' && browserHost !== '127.0.0.1') return configured;
  try {
    const url = new URL(configured);
    // Local web previews use this computer; phones retain the configured LAN IP.
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) url.hostname = browserHost;
    return url.toString();
  } catch { return configured; }
}

// Staff credentials never overwrite the customer's token or profile.
export const staffApi = create({
  baseURL: staffBaseURL(),
  timeout: 10000,
});
staffApi.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) updateStaff(null);
  return Promise.reject(error);
});
export async function signOutStaff() {
  try { await staffApi.post('/api/staff/auth/logout'); }
  finally { updateStaff(null); }
}

export async function signInStaff(identifier: string, password: string) {
  const { data } = await staffApi.post<{ token: string; user: StaffProfile }>(
    '/api/staff/auth/login', { identifier, password },
  );
  if (!data.token || !data.user || !['host', 'staff', 'manager'].includes(data.user.role)) {
    throw new Error('This account does not have access to the staff portal.');
  }
  // Keep the token in memory until secure persistent staff sessions are implemented.
  staffApi.defaults.headers.common.Authorization = `Bearer ${data.token}`;
  updateStaff(data.user);
  return data.user;
}
