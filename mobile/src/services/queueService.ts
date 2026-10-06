import apiClient from './api';
import { QueueEntry, QueueStatusResponse, ActiveQueueResponse } from '../types';

export interface JoinQueueParams {
  restaurantId: string;
  guests: number;
  specialRequests?: string;
}

export const joinQueue = async (params: JoinQueueParams): Promise<QueueEntry> => {
  const { data } = await apiClient.post<QueueEntry>('/api/queue/join', params);
  return data;
};

export const getActiveQueue = async (
  restaurantId: string
): Promise<ActiveQueueResponse> => {
  const { data } = await apiClient.get<ActiveQueueResponse>(
    `/api/queue/active/${restaurantId}`
  );
  return data;
};

export const getQueueHistory = async (): Promise<QueueEntry[]> => {
  const { data } = await apiClient.get<QueueEntry[]>('/api/queue');
  return data;
};

export const getQueueStatus = async (id: string): Promise<QueueStatusResponse> => {
  const { data } = await apiClient.get<QueueStatusResponse>(`/api/queue/${id}/status`);
  return data;
};

export const cancelQueue = async (id: string): Promise<QueueEntry> => {
  const { data } = await apiClient.put<QueueEntry>(`/api/queue/${id}/cancel`);
  return data;
};
