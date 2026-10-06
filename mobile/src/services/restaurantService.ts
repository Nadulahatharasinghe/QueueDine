import apiClient from './api';
import { Restaurant, Table, QueueStatsResponse } from '../types';

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
