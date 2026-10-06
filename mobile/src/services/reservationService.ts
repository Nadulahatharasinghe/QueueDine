import apiClient from './api';
import { Reservation, AvailabilityResponse } from '../types';

export interface CheckAvailabilityParams {
  restaurantId: string;
  date: string;
  time?: string;
  guests?: number;
}

export interface CreateReservationParams {
  restaurantId: string;
  tableId: string;
  date: string;
  time: string;
  guests: number;
  specialRequests?: string;
}

export interface ModifyReservationParams {
  date?: string;
  time?: string;
  guests?: number;
  tableId?: string;
  specialRequests?: string;
}

export const checkAvailability = async (
  params: CheckAvailabilityParams
): Promise<AvailabilityResponse> => {
  const { data } = await apiClient.post<AvailabilityResponse>(
    '/api/reservations/check-availability',
    params
  );
  return data;
};

export const createReservation = async (
  params: CreateReservationParams
): Promise<Reservation> => {
  const { data } = await apiClient.post<Reservation>('/api/reservations', params);
  return data;
};

export const getReservations = async (): Promise<Reservation[]> => {
  const { data } = await apiClient.get<Reservation[]>('/api/reservations');
  return data;
};

export const getReservation = async (id: string): Promise<Reservation> => {
  const { data } = await apiClient.get<Reservation>(`/api/reservations/${id}`);
  return data;
};

export const cancelReservation = async (id: string): Promise<Reservation> => {
  const { data } = await apiClient.put<Reservation>(`/api/reservations/${id}/cancel`);
  return data;
};

export const modifyReservation = async (
  id: string,
  params: ModifyReservationParams
): Promise<Reservation> => {
  const { data } = await apiClient.put<Reservation>(`/api/reservations/${id}`, params);
  return data;
};
