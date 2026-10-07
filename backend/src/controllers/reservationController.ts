import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Reservation, { IReservation } from '../models/Reservation';
import Table from '../models/Table';
import Restaurant from '../models/Restaurant';
import mongoose from 'mongoose';
import {
  createNotification,
  CreateNotificationInput,
} from './notificationController';
import { emitStaffNotification, syntheticPartyId } from '../utils/staffSync';

type SlotLabel = 'Available' | 'Limited' | 'Unavailable';
interface TimeSlot {
  time: string;
  label: SlotLabel;
}

const TIME_SLOTS = ['18:00', '18:30', '19:00', '20:00', '20:30', '21:00'];
const TIME_SLOT_LABELS: Record<string, string> = {
  '18:00': '6:00 PM',
  '18:30': '6:30 PM',
  '19:00': '7:00 PM',
  '20:00': '8:00 PM',
  '20:30': '8:30 PM',
  '21:00': '9:00 PM',
};

const formatDateISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDate = (s: string): Date | null => {
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d;
};

const isWithinOperatingHours = (time: string, open: string, close: string): boolean => {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const tm = toMin(time);
  return tm >= toMin(open) && tm <= toMin(close);
};

const getOwner = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId as string;
};

export const checkAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { restaurantId, date, time, guests } = req.body as {
      restaurantId?: string;
      date?: string;
      time?: string;
      guests?: number;
    };

    if (!restaurantId || !date) {
      res.status(400).json({ error: 'restaurantId and date are required' });
      return;
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const dateObj = parseDate(date);
    if (!dateObj) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      res.status(400).json({ error: 'Date cannot be in the past' });
      return;
    }

    const capacity = typeof guests === 'number' ? guests : 1;
    if (capacity < 1 || capacity > 20) {
      res.status(400).json({ error: 'Guests must be between 1 and 20' });
      return;
    }

    const open = restaurant.openingHours.open;
    const close = restaurant.openingHours.close;

    const slots: TimeSlot[] = [];
    const allTables = await Table.find({
      restaurantId,
      status: { $ne: 'occupied' },
      capacity: { $gte: capacity },
    });
    const suitableTableIds = allTables.map((t) => t._id as mongoose.Types.ObjectId);

    const existingConfirmed = await Reservation.find({
      restaurantId,
      date,
      status: 'confirmed',
      tableId: { $in: suitableTableIds },
    });

    const slotReservationsByTable: Record<string, Set<string>> = {};
    for (const r of existingConfirmed) {
      if (!slotReservationsByTable[r.time]) slotReservationsByTable[r.time] = new Set();
      slotReservationsByTable[r.time].add(String(r.tableId));
    }

    const totalSuitable = suitableTableIds.length;

    for (const slot of TIME_SLOTS) {
      if (!isWithinOperatingHours(slot, open, close)) {
        slots.push({ time: TIME_SLOT_LABELS[slot] || slot, label: 'Unavailable' });
        continue;
      }
      const taken = slotReservationsByTable[slot]?.size ?? 0;
      const remaining = totalSuitable - taken;
      let label: SlotLabel;
      if (remaining <= 0) label = 'Unavailable';
      else if (remaining <= Math.ceil(totalSuitable * 0.25)) label = 'Limited';
      else label = 'Available';

      if (time && time !== slot && time !== (TIME_SLOT_LABELS[slot] || slot)) {
        // keep all slots for grid regardless
      }
      slots.push({ time: TIME_SLOT_LABELS[slot] || slot, label });
    }

    let selectedTime = time;
    if (selectedTime) {
      const entry = Object.entries(TIME_SLOT_LABELS).find(([, v]) => v === selectedTime);
      if (entry) selectedTime = entry[0];
    }

    let availableTables: any[] = [];
    if (selectedTime) {
      const takenIds = slotReservationsByTable[selectedTime] ?? new Set<string>();
      availableTables = allTables
        .filter((t) => !takenIds.has(String(t._id)))
        .map((t) => ({
          _id: t._id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          status: t.status,
        }));
    }

    res.status(200).json({
      date,
      slots,
      availableTables,
      totalSuitableTables: totalSuitable,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to check availability' });
    }
  }
};

export const createReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const {
      restaurantId,
      tableId,
      date,
      time,
      guests,
      specialRequests,
    } = req.body as {
      restaurantId?: string;
      tableId?: string;
      date?: string;
      time?: string;
      guests?: number;
      specialRequests?: string;
    };

    if (!restaurantId || !tableId || !date || !time || typeof guests !== 'number') {
      res.status(400).json({
        error: 'restaurantId, tableId, date, time, and guests are required',
      });
      return;
    }

    const dateObj = parseDate(date);
    if (!dateObj) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      res.status(400).json({ error: 'Date cannot be in the past' });
      return;
    }

    if (guests < 1 || guests > 20) {
      res.status(400).json({ error: 'Guests must be between 1 and 20' });
      return;
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const table = await Table.findById(tableId);
    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    if (String(table.restaurantId) !== String(restaurantId)) {
      res.status(400).json({ error: 'Table does not belong to the restaurant' });
      return;
    }
    if (guests > table.capacity) {
      res.status(400).json({ error: 'Guests exceed table capacity' });
      return;
    }

    const open = restaurant.openingHours.open;
    const close = restaurant.openingHours.close;
    if (!isWithinOperatingHours(time, open, close)) {
      res.status(400).json({ error: 'Time is outside operating hours' });
      return;
    }

    let normalizedTime = time;
    const labelEntry = Object.entries(TIME_SLOT_LABELS).find(([, v]) => v === time);
    if (labelEntry) normalizedTime = labelEntry[0];

    let reservation: IReservation | null = null;
    try {
      const createPayload: any = {
        userId,
        restaurantId,
        tableId,
        date,
        time: normalizedTime,
        guests,
        status: 'confirmed',
      };
      if (specialRequests !== undefined && specialRequests !== null) {
        createPayload.specialRequests = specialRequests;
      }
      reservation = (await Reservation.create(createPayload)) as IReservation;
    } catch (e: any) {
      if (e?.code === 11000) {
        res.status(409).json({ error: 'Table already booked for this slot' });
        return;
      }
      throw e;
    }

    const populated = reservation
      ? await Reservation.findById((reservation as IReservation)._id)
          .populate('restaurantId', 'name location imageUrl photoFileId')
          .populate('tableId', 'tableNumber capacity')
      : null;

    // Create notification
    const restName = restaurant?.name || 'Restaurant';
    const displayTime = TIME_SLOT_LABELS[normalizedTime] || normalizedTime;
    const displayNumber = `R-${String((reservation as IReservation)._id).slice(-6).toUpperCase()}`;
    void createNotification({
      userId,
      type: 'reservation_created',
      title: 'Reservation Confirmed',
      message: `Your reservation at ${restName} on ${date} at ${displayTime} for ${guests} guests has been confirmed.`,
      relatedId: (reservation as IReservation)._id,
      relatedType: 'reservation',
    });
    void emitStaffNotification(restaurantId, {
      category: 'Reservations',
      message: `New reservation ${displayNumber}: ${guests} guests on ${date} at ${displayTime}`,
      partyId: syntheticPartyId((reservation as IReservation)._id),
    });

    res.status(201).json(populated);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create reservation' });
    }
  }
};

export const getMyReservations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const reservations = await Reservation.find({ userId })
      .populate('restaurantId', 'name location imageUrl photoFileId')
      .populate('tableId', 'tableNumber capacity')
      .sort({ createdAt: -1 });

    res.status(200).json(reservations);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  }
};

export const getReservationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { id } = req.params;
    const reservation = await Reservation.findById(id)
      .populate('restaurantId', 'name location imageUrl photoFileId')
      .populate('tableId', 'tableNumber capacity');

    if (!reservation) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }
    if (String(reservation.userId) !== String(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(reservation);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch reservation' });
    }
  }
};

export const cancelReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { id } = req.params;
    const reservation = await Reservation.findById(id).populate(
      'restaurantId',
      'name location imageUrl photoFileId'
    );
    if (!reservation) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }
    if (String(reservation.userId) !== String(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const restaurantId = (reservation.restaurantId as unknown as { _id: mongoose.Types.ObjectId })._id;
    if (reservation.status === 'cancelled') {
      res.status(400).json({ error: 'Reservation is already cancelled' });
      return;
    }
    if (reservation.status === 'completed') {
      res.status(400).json({ error: 'Cannot cancel a completed reservation' });
      return;
    }

    reservation.status = 'cancelled';
    reservation.cancelledAt = new Date();
    await reservation.save();

    const populated = await Reservation.findById(reservation._id)
      .populate('restaurantId', 'name location imageUrl photoFileId')
      .populate('tableId', 'tableNumber capacity');

    const restName =
      typeof populated?.restaurantId === 'object'
        ? (populated.restaurantId as any).name
        : 'Restaurant';
    const displayTime = TIME_SLOT_LABELS[reservation.time] || reservation.time;
    const displayNumber = `R-${String(reservation._id).slice(-6).toUpperCase()}`;
    void createNotification({
      userId,
      type: 'reservation_cancelled',
      title: 'Reservation Cancelled',
      message: `Your reservation at ${restName} on ${reservation.date} at ${displayTime} has been cancelled.`,
      relatedId: reservation._id,
      relatedType: 'reservation',
    });
    void emitStaffNotification(String(restaurantId), {
      category: 'Reservations',
      message: `Reservation ${displayNumber} cancelled by customer (was ${reservation.date} at ${displayTime})`,
      partyId: syntheticPartyId(reservation._id),
    });

    res.status(200).json(populated);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to cancel reservation' });
    }
  }
};

export const modifyReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { id } = req.params;
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }
    if (String(reservation.userId) !== String(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (reservation.status === 'cancelled' || reservation.status === 'completed') {
      res.status(400).json({ error: 'Cannot modify cancelled/completed reservation' });
      return;
    }

    const {
      date,
      time,
      guests,
      tableId,
      specialRequests,
    } = req.body as {
      date?: string;
      time?: string;
      guests?: number;
      tableId?: string;
      specialRequests?: string;
    };

    let newDate = reservation.date;
    if (date !== undefined) {
      const d = parseDate(date);
      if (!d) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) {
        res.status(400).json({ error: 'Date cannot be in the past' });
        return;
      }
      newDate = date;
    }

    let newTime = reservation.time;
    if (time !== undefined) {
      const labelEntry = Object.entries(TIME_SLOT_LABELS).find(([, v]) => v === time);
      newTime = labelEntry ? labelEntry[0] : time;
      const restaurant = await Restaurant.findById(reservation.restaurantId);
      if (restaurant) {
        if (
          !isWithinOperatingHours(
            newTime,
            restaurant.openingHours.open,
            restaurant.openingHours.close
          )
        ) {
          res.status(400).json({ error: 'Time is outside operating hours' });
          return;
        }
      }
    }

    let newGuests = reservation.guests;
    if (typeof guests === 'number') {
      if (guests < 1 || guests > 20) {
        res.status(400).json({ error: 'Guests must be between 1 and 20' });
        return;
      }
      newGuests = guests;
    }

    let newTableId = reservation.tableId as mongoose.Types.ObjectId;
    if (tableId !== undefined) {
      const t = await Table.findById(tableId);
      if (!t) {
        res.status(404).json({ error: 'Table not found' });
        return;
      }
      if (String(t.restaurantId) !== String(reservation.restaurantId)) {
        res.status(400).json({ error: 'Table does not belong to restaurant' });
        return;
      }
      newTableId = t._id as mongoose.Types.ObjectId;
    }

    const checkTable = await Table.findById(newTableId);
    if (checkTable && newGuests > checkTable.capacity) {
      res.status(400).json({ error: 'Guests exceed table capacity' });
      return;
    }

    if (specialRequests !== undefined) reservation.specialRequests = specialRequests;

    // Conflict check: ensure new (tableId, date, time, status=confirmed) is free,
    // excluding the current reservation id from the check.
    const conflict = await Reservation.findOne({
      _id: { $ne: reservation._id },
      tableId: newTableId,
      date: newDate,
      time: newTime,
      status: 'confirmed',
    });

    if (conflict) {
      res.status(409).json({ error: 'Table already booked for the new slot' });
      return;
    }

    // Update the existing reservation in place
    reservation.date = newDate;
    reservation.time = newTime;
    reservation.guests = newGuests;
    reservation.tableId = newTableId;
    await reservation.save();

    const populated = await Reservation.findById(reservation._id)
      .populate('restaurantId', 'name location imageUrl photoFileId')
      .populate('tableId', 'tableNumber capacity');

    const restName =
      typeof populated?.restaurantId === 'object'
        ? (populated.restaurantId as any).name
        : 'Restaurant';
    const displayTime = TIME_SLOT_LABELS[newTime] || newTime;
    const displayNumber = `R-${String(reservation._id).slice(-6).toUpperCase()}`;
    void createNotification({
      userId,
      type: 'reservation_modified',
      title: 'Reservation Updated',
      message: `Your reservation at ${restName} has been updated to ${newDate} at ${displayTime} for ${newGuests} guests.`,
      relatedId: reservation._id,
      relatedType: 'reservation',
    });
    void emitStaffNotification(String(reservation.restaurantId), {
      category: 'Reservations',
      message: `Reservation ${displayNumber} updated by customer: ${newGuests} guests on ${newDate} at ${displayTime}`,
      partyId: syntheticPartyId(reservation._id),
    });

    res.status(200).json(populated);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to modify reservation' });
    }
  }
};

export { TIME_SLOT_LABELS, formatDateISO, parseDate };
