import { isAxiosError } from 'axios';
import { staffApi, StaffProfile } from './staffAuth';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export interface StaffTable {
  _id: string; number: string; capacity: number; area: 'Main Area' | 'Outdoor';
  status: TableStatus; partyId: string | null; holdExpiresAt: string | null;
}
export interface Party {
  _id: string; number: string; kind: 'queue' | 'reservation'; customerName: string;
  mobileNumber: string; partySize: number; specialRequests: string; status: string;
  bookingAt?: string; createdAt: string; tableId: string | null; holdExpiresAt: string | null;
}
export interface StaffEvent {
  _id: string; message: string; category: string; actorName?: string; createdAt: string;
  partyId?: string; tableId?: string; read?: boolean;
}
export interface Restaurant { _id: string; name: string; location: string; timeZone: string; photoUrl?: string | null }
export interface EditableStaffRestaurant {
  _id: string;
  name: string;
  description: string;
  location: string;
  cuisine: string;
  openingHours: { open: string; close: string };
  rating: number;
  reviewCount: number;
  photoFileId: string | null;
  photoUrl: string | null;
  staffRestaurantId: string;
}
export interface Dashboard {
  user: StaffProfile; restaurant: Restaurant; tables: StaffTable[]; waiting: number;
  estimate: number; next: Party | null; unread: number;
}
export interface StaffRestaurantPhotoResponse {
  success: boolean;
  photoUrl: string | null;
  photoFileId: string | null;
  restaurantId: string;
  restaurantName: string;
}
export function errorMessage(error: unknown) {
  if (isAxiosError(error)) return typeof error.response?.data?.error === 'string'
    ? error.response.data.error : 'Unable to reach the server. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
export function requestKey() { return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
export const getStaffData = async <T,>(path: string): Promise<T> => (await staffApi.get<T>(`/api/staff/${path}`)).data;
export const postStaffData = async <T,>(path: string, body: unknown, key?: string): Promise<T> => (await staffApi.post<T>(`/api/staff/${path}`, body, key ? { headers: { 'Idempotency-Key': key } } : undefined)).data;
export const patchStaffData = async <T,>(path: string, body: unknown): Promise<T> => (await staffApi.patch<T>(`/api/staff/${path}`, body)).data;
export const putStaffData = async <T,>(path: string, body: unknown): Promise<T> => (await staffApi.put<T>(`/api/staff/${path}`, body)).data;
export const getStaffRestaurantPhoto = async (): Promise<StaffRestaurantPhotoResponse> =>
  (await staffApi.get<StaffRestaurantPhotoResponse>('/api/staff/restaurant-photo')).data;
export const putStaffRestaurantPhoto = async (formData: FormData): Promise<StaffRestaurantPhotoResponse> =>
  (await staffApi.put<StaffRestaurantPhotoResponse>('/api/staff/restaurant-photo', formData, {
    timeout: 60000,
  })).data;
export const deleteStaffRestaurantPhoto = async (): Promise<{ success: boolean; message?: string }> =>
  (await staffApi.delete<{ success: boolean; message?: string }>('/api/staff/restaurant-photo')).data;
