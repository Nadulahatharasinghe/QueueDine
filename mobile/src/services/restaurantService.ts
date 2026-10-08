import apiClient from './api';
import { Restaurant, Table, QueueStatsResponse } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export function photoUri(relative: string | null | undefined): string | null {
  if (!relative) return null;
  if (/^https?:\/\//i.test(relative)) return relative;
  const trimmed = relative.startsWith('/') ? relative : `/${relative}`;
  return `${API_URL.replace(/\/$/, '')}${trimmed}`;
}

export const getRestaurants = async (): Promise<Restaurant[]> => {
  const { data } = await apiClient.get<Restaurant[]>('/api/restaurants');
  return data;
};

export const getRestaurant = async (id: string): Promise<Restaurant> => {
  const { data } = await apiClient.get<Restaurant>(`/api/restaurants/${id}`);
  return data;
};

export const getFirstRestaurant = async (): Promise<Restaurant | null> => {
  const list = await getRestaurants();
  return list && list.length > 0 ? list[0] : null;
};

export const getTables = async (restaurantId: string): Promise<Table[]> => {
  const { data } = await apiClient.get<Table[]>(`/api/restaurants/${restaurantId}/tables`);
  return data;
};

export const getQueueStats = async (restaurantId: string): Promise<QueueStatsResponse> => {
  const { data } = await apiClient.get<QueueStatsResponse>(
    `/api/restaurants/${restaurantId}/queue-stats`
  );
  return data;
};
