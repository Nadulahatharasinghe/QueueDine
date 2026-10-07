import mongoose, { Types, ClientSession, Document } from 'mongoose';
import Reservation, { IReservation } from '../models/Reservation';
import QueueEntry, { IQueueEntry } from '../models/QueueEntry';
import User, { IUser } from '../models/User';
import Restaurant, { IRestaurant } from '../models/Restaurant';
import { StaffNotification, StaffEvent, StaffAlert } from '../staff/models';
import { createNotification } from '../controllers/notificationController';
import { findStaffRestaurantByCustomerId } from './restaurantLink';

export function isSyntheticId(id: string): 'res' | 'que' | null {
  if (typeof id !== 'string') return null;
  if (id.startsWith('res_')) return 'res';
  if (id.startsWith('que_')) return 'que';
  return null;
}

export function syntheticPartyId(reservationId: Types.ObjectId | string): string {
  return `res_${String(reservationId)}`;
}

export function syntheticQueueId(queueEntryId: Types.ObjectId | string): string {
  return `que_${String(queueEntryId)}`;
}

export function extractSyntheticObjectId(id: string): Types.ObjectId {
  const trimmed = id.slice(4);
  return new Types.ObjectId(trimmed);
}

export function mapReservationStatusToStaff(
  status: IReservation['status']
): 'upcoming' | 'cancelled' | 'seated' {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return 'upcoming';
    case 'cancelled':
      return 'cancelled';
    case 'completed':
      return 'seated';
  }
}

export function mapQueueStatusToStaff(
  status: IQueueEntry['status']
): 'waiting' | 'ready' | 'seated' | 'cancelled' {
  switch (status) {
    case 'waiting':
      return 'waiting';
    case 'called':
      return 'ready';
    case 'seated':
      return 'seated';
    case 'cancelled':
      return 'cancelled';
  }
}

function wallClockToBookingDate(date: string, time: string): Date {
  const iso = `${date}T${time}:00+05:30`;
  const d = new Date(iso);
  if (Number.isFinite(d.getTime())) return d;
  return new Date(`${date}T${time}:00Z`);
}

function customerPhoneNumber(user: IUser | null): string {
  if (!user) return '+940000000000';
  if (user.phone && /^\+?[\d\s()-]+$/.test(user.phone)) return user.phone;
  return '+940000000000';
}

export async function reservationToPartyDTO(
  reservation: IReservation & { userId?: IUser | Types.ObjectId | unknown; restaurantId?: IRestaurant | Types.ObjectId | unknown }
): Promise<Record<string, unknown>> {
  let user: IUser | null = null;
  if (reservation.userId && typeof reservation.userId === 'object' && !('toHexString' in reservation.userId)) {
    user = reservation.userId as unknown as IUser;
  } else if (reservation.userId) {
    user = await User.findById(reservation.userId).lean();
  }
  const customerName = user?.fullName || 'Guest Customer';
  const mobileNumber = customerPhoneNumber(user);
  const bookingAt = wallClockToBookingDate(reservation.date, reservation.time);
  return {
    _id: syntheticPartyId(reservation._id),
    id: syntheticPartyId(reservation._id),
    synthetic: true,
    source: 'reservation',
    sourceId: String(reservation._id),
    restaurantId: String(reservation.restaurantId),
    kind: 'reservation',
    number: `R-${String(reservation._id).slice(-6).toUpperCase()}`,
    customerName,
    mobileNumber,
    partySize: reservation.guests,
    specialRequests: reservation.specialRequests || '',
    status: mapReservationStatusToStaff(reservation.status),
    sourceStatus: reservation.status,
    bookingAt,
    tableId: null,
    holdExpiresAt: null,
    seatedAt: null,
    cancelledAt: reservation.cancelledAt || null,
    requestId: `cust-res-${String(reservation._id)}`,
    createdBy: String(reservation.userId),
    userId: String(reservation.userId),
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

export async function queueEntryToPartyDTO(
  entry: IQueueEntry & { userId?: IUser | Types.ObjectId | unknown; restaurantId?: IRestaurant | Types.ObjectId | unknown }
): Promise<Record<string, unknown>> {
  let user: IUser | null = null;
  if (entry.userId && typeof entry.userId === 'object' && !('toHexString' in entry.userId)) {
    user = entry.userId as unknown as IUser;
  } else if (entry.userId) {
    user = await User.findById(entry.userId).lean();
  }
  const customerName = user?.fullName || 'Guest Customer';
  const mobileNumber = customerPhoneNumber(user);
  return {
    _id: syntheticQueueId(entry._id),
    id: syntheticQueueId(entry._id),
    synthetic: true,
    source: 'queue',
    sourceId: String(entry._id),
    restaurantId: String(entry.restaurantId),
    kind: 'queue',
    number: `Q-${String(entry.queueNumber).padStart(3, '0')}`,
    queueNumber: entry.queueNumber,
    position: entry.position,
    estimatedWaitTime: entry.estimatedWaitTime,
    customerName,
    mobileNumber,
    partySize: entry.guests,
    specialRequests: entry.specialRequests || '',
    status: mapQueueStatusToStaff(entry.status),
    sourceStatus: entry.status,
    bookingAt: entry.joinedAt,
    tableId: null,
    holdExpiresAt: null,
    seatedAt: entry.seatedAt || null,
    cancelledAt: entry.cancelledAt || null,
    requestId: `cust-que-${String(entry._id)}`,
    createdBy: String(entry.userId),
    userId: String(entry.userId),
    createdAt: entry.joinedAt,
    updatedAt: entry.updatedAt,
  };
}

export function scopedReservationsCursor(
  customerRestaurantId: Types.ObjectId,
  opts: { date?: string; includeAllStatuses?: boolean } = {}
) {
  const filter: Record<string, unknown> = { restaurantId: customerRestaurantId };
  if (opts.date) filter.date = opts.date;
  if (!opts.includeAllStatuses) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    filter.date = { $gte: `${y}-${m}-${d}` };
  }
  return Reservation.find(filter).sort({ date: 1, time: 1 }).limit(500).populate('userId', 'fullName phone email');
}

export function scopedQueueCursor(
  customerRestaurantId: Types.ObjectId,
  opts: { activeOnly?: boolean } = {}
) {
  const filter: Record<string, unknown> = { restaurantId: customerRestaurantId };
  if (opts.activeOnly) filter.status = { $in: ['waiting', 'called'] };
  return QueueEntry.find(filter).sort({ joinedAt: 1 }).limit(500).populate('userId', 'fullName phone email');
}

export class SyntheticAccessError extends Error {
  constructor(message: string, public statusCode = 404) { super(message); }
}

export async function findResoUnderStaff(
  syntheticId: string,
  customerRestaurantId: Types.ObjectId
): Promise<IReservation> {
  const oid = extractSyntheticObjectId(syntheticId);
  const res = await Reservation.findOne({ _id: oid, restaurantId: customerRestaurantId }).populate('userId', 'fullName phone email');
  if (!res) throw new SyntheticAccessError('Reservation not found or not accessible.', 404);
  return res;
}

export async function findQueueUnderStaff(
  syntheticId: string,
  customerRestaurantId: Types.ObjectId
): Promise<IQueueEntry> {
  const oid = extractSyntheticObjectId(syntheticId);
  const qe = await QueueEntry.findOne({ _id: oid, restaurantId: customerRestaurantId }).populate('userId', 'fullName phone email');
  if (!qe) throw new SyntheticAccessError('Queue entry not found or not accessible.', 404);
  return qe;
}

export async function emitStaffNotification(
  customerRestaurantId: Types.ObjectId | string,
  opts: {
    category: 'Queue' | 'Reservations' | 'System';
    message: string;
    partyId?: string;
    tableId?: string;
    actorName?: string;
    session?: ClientSession;
  }
): Promise<void> {
  try {
    const staffRestaurant = await findStaffRestaurantByCustomerId(customerRestaurantId);
    if (!staffRestaurant) {
      console.warn('[staffSync] emitStaffNotification: no staff restaurant mapped for ', customerRestaurantId);
      return;
    }
    const eventDoc = {
      restaurantId: staffRestaurant._id,
      actorName: opts.actorName || 'Customer App',
      message: opts.message,
      category: opts.category,
      partyId: opts.partyId,
      tableId: opts.tableId,
    };
    if (opts.session) {
      await StaffEvent.create([eventDoc], { session: opts.session });
      await StaffNotification.create([eventDoc], { session: opts.session });
    } else {
      await StaffEvent.create(eventDoc);
      await StaffNotification.create(eventDoc);
    }
  } catch (error) {
    console.error('[staffSync] emitStaffNotification failed:', error instanceof Error ? error.message : error);
  }
}

export async function emitCustomerNotificationForStaffAction(
  input: {
    userId: Types.ObjectId | string;
    reservationId?: Types.ObjectId | string | null;
    queueEntryId?: Types.ObjectId | string | null;
    type: Parameters<typeof createNotification>[0]['type'];
    title: string;
    message: string;
  }
): Promise<void> {
  try {
    const relatedId = (input.reservationId || input.queueEntryId || null) as Types.ObjectId | null;
    const relatedType: 'reservation' | 'queue' | null = input.reservationId ? 'reservation' : (input.queueEntryId ? 'queue' : null);
    await createNotification({
      userId: typeof input.userId === 'string' ? new Types.ObjectId(input.userId) : input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedId,
      relatedType,
    });
  } catch (error) {
    console.error('[staffSync] emitCustomerNotificationForStaffAction failed:', error instanceof Error ? error.message : error);
  }
}
