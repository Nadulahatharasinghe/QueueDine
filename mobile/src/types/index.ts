export interface Restaurant {
  _id: string;
  name: string;
  location: string;
  rating: number;
  reviewCount: number;
  imageUrl?: string | null;
  description: string;
  openingHours: {
    open: string;
    close: string;
  };
  cuisine?: string;
  currentWaitTime: number;
  queueLength: number;
  availableTables: number;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  _id: string;
  restaurantId: string;
  tableNumber: number;
  capacity: number;
  status: 'available' | 'reserved' | 'occupied';
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Reservation {
  _id: string;
  userId: string;
  restaurantId: string | { _id: string; name: string; location: string };
  tableId: string | { _id: string; tableNumber: number; capacity: number };
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  specialRequests?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type QueueStatus = 'waiting' | 'called' | 'seated' | 'cancelled';

export interface QueueEntry {
  _id: string;
  userId: string;
  restaurantId: string | { _id: string; name: string; location: string };
  queueNumber: number;
  guests: number;
  position: number;
  estimatedWaitTime: number;
  status: QueueStatus;
  specialRequests?: string | null;
  joinedAt: string;
  calledAt?: string | null;
  seatedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  time: string;
  label: 'Available' | 'Limited' | 'Unavailable';
}

export interface AvailabilityResponse {
  date: string;
  slots: TimeSlot[];
  availableTables: Table[];
  totalSuitableTables: number;
}

export interface ApiError {
  error: string;
}

export interface QueueStatusResponse {
  entry: QueueEntry;
  partiesAhead: number;
  currentCalledQueueNumber: number | null;
}

export interface ActiveQueueResponse {
  entry: QueueEntry | null;
  partiesAhead: number;
}

export interface QueueStatsResponse {
  queueLength: number;
  estimatedWaitTime: number;
  partiesAhead: number;
}

export type NotificationType =
  | 'reservation_created'
  | 'reservation_modified'
  | 'reservation_cancelled'
  | 'queue_joined'
  | 'queue_position_changed'
  | 'queue_next'
  | 'queue_cancelled'
  | 'queue_status_changed'
  | 'system';

export type RelatedType = 'reservation' | 'queue' | 'restaurant' | 'system';

export interface NotificationItem {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string | null;
  relatedType: RelatedType | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllReadResponse {
  markedCount: number;
}
