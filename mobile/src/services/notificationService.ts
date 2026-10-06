import apiClient from './api';
import {
  NotificationItem,
  NotificationsResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
} from '../types';

export const getNotifications = async (): Promise<NotificationsResponse> => {
  const { data } = await apiClient.get<NotificationsResponse>('/api/notifications');
  return data;
};

export const getUnreadCount = async (): Promise<UnreadCountResponse> => {
  const { data } = await apiClient.get<UnreadCountResponse>(
    '/api/notifications/unread-count'
  );
  return data;
};

export const markAsRead = async (id: string): Promise<NotificationItem> => {
  const { data } = await apiClient.put<NotificationItem>(
    `/api/notifications/${id}/read`
  );
  return data;
};

export const markAllAsRead = async (): Promise<MarkAllReadResponse> => {
  const { data } = await apiClient.put<MarkAllReadResponse>(
    '/api/notifications/read-all'
  );
  return data;
};
