import { Router, Request, Response, NextFunction } from 'express';
import mongoose, { ClientSession, HydratedDocument, InferSchemaType, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { StaffAccount, StaffSession, StaffRestaurant, StaffTable, StaffParty, StaffEvent, StaffNotification, StaffAlert } from './models';
import { StaffError, text, partyInput, bookingTime, waitEstimate, terminalStatuses } from './domain';
import { upload } from '../utils/upload';
import { storePhoto, deleteFileIfExists } from '../utils/gridfs';
import { resolveStaffRestaurant, getCustomerRestaurantIdForStaff } from '../utils/restaurantLink';
import Restaurant from '../models/Restaurant';
import Reservation from '../models/Reservation';
import QueueEntry from '../models/QueueEntry';
import { recalculatePositions } from '../controllers/queueController';
import {
  isSyntheticId,
  SyntheticAccessError,
  scopedReservationsCursor,
  scopedQueueCursor,
  reservationToPartyDTO,
  queueEntryToPartyDTO,
  findResoUnderStaff,
  findQueueUnderStaff,
  syntheticPartyId,
  syntheticQueueId,
  emitCustomerNotificationForStaffAction,
} from '../utils/staffSync';

type Account = HydratedDocument<InferSchemaType<typeof StaffAccount.schema>>;
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next); };
const account = (res: Response): Account => res.locals.staff;
const secret = () => {
  const value = process.env.STAFF_JWT_SECRET || process.env.JWT_SECRET;
  if (!value) throw new StaffError(503, 'Staff authentication is not configured.');
  return value;
};
const profile = (a: Account) => ({ _id: a._id, staffId: a.staffId, fullName: a.fullName, email: a.email, role: a.role, restaurantId: a.restaurantId, onDuty: a.onDuty, shiftStart: a.shiftStart, shiftEnd: a.shiftEnd, settings: a.settings });
export const staffRoutes = Router();
const attempts = new Map<string, { count: number; until: number }>();
staffRoutes.post('/auth/login', wrap(async (req, res) => {
  const identifier = text(req.body.identifier, 'Staff ID or email').toLowerCase();
  text(req.body.password, 'Password', 200);
  const password = req.body.password as string;
  const signingSecret = secret();
  const key = `${req.ip}:${identifier}`;
  const now = Date.now();
  if (attempts.size > 1000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const attempt = attempts.get(key);
  if (attempt && attempt.until > now && attempt.count >= 10) throw new StaffError(429, 'Too many attempts. Try again in 15 minutes.');
  const a = await StaffAccount.findOne({ $or: [{ email: identifier }, { staffId: identifier }], isActive: true }).select('+passwordHash');
  if (!a || !await bcrypt.compare(password, a.passwordHash)) {
    attempts.set(key, { count: attempt && attempt.until > now ? attempt.count + 1 : 1, until: now + 15 * 60000 });
    throw new StaffError(401, 'Invalid staff credentials.');
  }
  attempts.delete(key);
  const s = await StaffSession.create({ accountId: a._id, expiresAt: new Date(now + 8 * 3600000) });
  const token = jwt.sign({ accountId: a._id, sessionId: s._id }, signingSecret, { audience: 'queuedine-staff', expiresIn: '8h' });
  res.json({ token, user: profile(a) });
}));
staffRoutes.use(wrap(async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new StaffError(401, 'Staff sign-in required.');
    const payload = jwt.verify(token, secret(), { audience: 'queuedine-staff' }) as jwt.JwtPayload;
    const session = await StaffSession.findOne({ _id: payload.sessionId, accountId: payload.accountId, expiresAt: { $gt: new Date() } });
    const a = session && await StaffAccount.findOne({ _id: session.accountId, isActive: true });
    if (!a) throw new StaffError(401, 'Your staff session has expired.');
    res.locals.staff = a; res.locals.sessionId = session!._id;
    next();
  } catch (error) {
    if (error instanceof StaffError) throw error;
    throw new StaffError(401, 'Invalid staff session.');
  }
}));

staffRoutes.post('/auth/logout', wrap(async (_req, res) => {
  const sessionId = res.locals.sessionId;
  if (sessionId) {
    await StaffSession.deleteOne({ _id: sessionId });
  }
  res.sendStatus(204);
}));

async function record(a: Account, message: string, category: 'Queue' | 'Reservations' | 'System', session: ClientSession, partyId?: string, tableId?: string) {
  const event = { restaurantId: a.restaurantId, actorName: a.fullName, message, category, partyId, tableId };
  await StaffEvent.create([event], { session });
  await StaffNotification.create([event], { session });
}
async function findParty(a: Account, id: string, session?: ClientSession) {
  const p = await StaffParty.findOne({ _id: id, restaurantId: a.restaurantId }).session(session || null);
  if (!p) throw new StaffError(404, 'Customer entry not found.');
  return p;
}
async function findTable(a: Account, id: string, session?: ClientSession) {
  const t = await StaffTable.findOne({ _id: id, restaurantId: a.restaurantId }).session(session || null);
  if (!t) throw new StaffError(404, 'Table not found.');
  return t;
}
export async function releaseExpiredHolds() {
  const expired = await StaffTable.find({ status: 'reserved', holdExpiresAt: { $lte: new Date() } }).limit(100);
  for (const item of expired) await mongoose.connection.transaction(async session => {
    const t = await StaffTable.findOne({ _id: item._id, status: 'reserved', holdExpiresAt: { $lte: new Date() } }).session(session);
    if (!t) return;
    const partyId = t.partyId;
    if (partyId) {
      const p = await StaffParty.findOne({ _id: partyId, restaurantId: t.restaurantId, tableId: t._id }).session(session);
      if (p && !terminalStatuses.includes(p.status)) {
        p.status = 'no-show'; p.tableId = null; p.holdExpiresAt = null;
        await p.save({ session });
      }
    }
    t.status = 'available'; t.partyId = null; t.holdExpiresAt = null; await t.save({ session });
    const event = { restaurantId: t.restaurantId, actorName: 'System', message: `Table ${t.number} hold expired and was released`, category: 'Reservations' as const, partyId: partyId || undefined, tableId: t._id };
    await StaffEvent.create([event], { session }); await StaffNotification.create([event], { session });
  });
}
staffRoutes.get('/me', wrap(async (_req, res) => {
  res.json({ user: profile(account(res)), restaurant: await StaffRestaurant.findById(account(res).restaurantId) });
}));
staffRoutes.post('/auth/logout', wrap(async (_req, res) => { await StaffSession.deleteOne({ _id: res.locals.sessionId }); res.sendStatus(204); }));
staffRoutes.patch('/me', wrap(async (req, res) => {
  const a = account(res);
  if (req.body.onDuty !== undefined) {
    if (typeof req.body.onDuty !== 'boolean') throw new StaffError(400, 'Duty status must be a boolean.');
    a.onDuty = req.body.onDuty;
  }
  if (req.body.fullName !== undefined) a.fullName = text(req.body.fullName, 'Full name');
  for (const key of ['queueAlerts', 'reservationAlerts'] as const) {
    if (req.body[key] !== undefined) {
      if (typeof req.body[key] !== 'boolean') throw new StaffError(400, 'Preferences must be booleans.');
      a.set(`settings.${key}`, req.body[key]);
    }
  }
  await a.save(); res.json(profile(a));
}));
staffRoutes.get('/restaurant', wrap(async (_req, res) => {
  const a = account(res);
  const { customerRestaurant, staffRestaurant } = await resolveStaffRestaurant(a);
  res.json({
    _id: String(customerRestaurant._id),
    name: customerRestaurant.name,
    description: customerRestaurant.description,
    location: customerRestaurant.location,
    cuisine: customerRestaurant.cuisine || '',
    openingHours: { open: customerRestaurant.openingHours?.open || '11:00', close: customerRestaurant.openingHours?.close || '23:00' },
    rating: customerRestaurant.rating,
    reviewCount: customerRestaurant.reviewCount,
    photoFileId: customerRestaurant.photoFileId ? String(customerRestaurant.photoFileId) : null,
    photoUrl: customerRestaurant.imageUrl || null,
    staffRestaurantId: String(staffRestaurant._id),
  });
}));
staffRoutes.put('/restaurant', wrap(async (req, res) => {
  const a = account(res);
  const body = req.body || {};
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = text(body.name, 'Restaurant name');
  if (body.description !== undefined) patch.description = text(body.description, 'Description', 2000);
  if (body.location !== undefined) patch.location = text(body.location, 'Location');
  if (body.cuisine !== undefined && body.cuisine !== '') patch.cuisine = text(body.cuisine, 'Cuisine', 80);
  if (body.cuisine === '') patch.cuisine = '';
  const hours: Record<string, string> = {};
  if (body.openingHours && typeof body.openingHours === 'object') {
    const hhmm = /^\d{2}:\d{2}$/;
    if (body.openingHours.open !== undefined) {
      const o = String(body.openingHours.open).trim();
      if (!hhmm.test(o)) throw new StaffError(400, 'Opening time must use HH:MM format.');
      hours.open = o;
    }
    if (body.openingHours.close !== undefined) {
      const c = String(body.openingHours.close).trim();
      if (!hhmm.test(c)) throw new StaffError(400, 'Closing time must use HH:MM format.');
      hours.close = c;
    }
    if (Object.keys(hours).length) patch.openingHours = { ...hours };
  }
  if (!Object.keys(patch).length) throw new StaffError(400, 'No fields supplied for update.');
  const { customerRestaurant, staffRestaurant } = await resolveStaffRestaurant(a);
  Object.assign(customerRestaurant, patch);
  await customerRestaurant.save();
  const denorm: Record<string, unknown> = {};
  if (patch.name !== undefined) denorm.name = patch.name;
  if (patch.location !== undefined) denorm.location = patch.location;
  if (Object.keys(denorm).length) {
    Object.assign(staffRestaurant, denorm);
    await staffRestaurant.save();
  }
  res.json({
    _id: String(customerRestaurant._id),
    name: customerRestaurant.name,
    description: customerRestaurant.description,
    location: customerRestaurant.location,
    cuisine: customerRestaurant.cuisine || '',
    openingHours: { open: customerRestaurant.openingHours?.open || '11:00', close: customerRestaurant.openingHours?.close || '23:00' },
    rating: customerRestaurant.rating,
    reviewCount: customerRestaurant.reviewCount,
    photoFileId: customerRestaurant.photoFileId ? String(customerRestaurant.photoFileId) : null,
    photoUrl: customerRestaurant.imageUrl || null,
    staffRestaurantId: String(staffRestaurant._id),
  });
}));
staffRoutes.get('/dashboard', wrap(async (_req, res) => {
  const a = account(res);
  const tables = await StaffTable.find({ restaurantId: a.restaurantId }).sort('number');
  const customerRestaurantId = await getCustomerRestaurantIdForStaff(a);
  const staffWaiting = await StaffParty.countDocuments({ restaurantId: a.restaurantId, kind: 'queue', status: { $in: ['waiting', 'almost-ready', 'ready'] } });
  const customerWaiting = await QueueEntry.countDocuments({ restaurantId: customerRestaurantId, status: { $in: ['waiting', 'called'] } });
  const waiting = staffWaiting + customerWaiting;
  const available = tables.filter(t => t.status === 'available').length;
  const staffNext = await StaffParty.findOne({ restaurantId: a.restaurantId, status: { $in: ['waiting', 'almost-ready', 'ready', 'arrived'] } }).sort('createdAt').lean();
  const customerNextQ = await QueueEntry.findOne({ restaurantId: customerRestaurantId, status: { $in: ['waiting', 'called'] } }).sort('joinedAt').lean();
  let next: unknown = staffNext || null;
  if (customerNextQ) {
    const custDto = await queueEntryToPartyDTO(customerNextQ as any);
    if (!next || (custDto.createdAt as any).getTime() < ((next as any).createdAt?.getTime() ?? Infinity)) {
      next = custDto;
    }
  }
  const unread = await StaffNotification.countDocuments({ restaurantId: a.restaurantId, readBy: { $ne: a._id } });
  res.json({ user: profile(a), restaurant: await StaffRestaurant.findById(a.restaurantId), tables, waiting, estimate: waitEstimate(waiting, available), next, unread });
}));
staffRoutes.get('/parties', wrap(async (req, res) => {
  const kind = req.query.kind === 'reservation' ? 'reservation' : 'queue';
  const a = account(res);
  const staffParties = await StaffParty.find({ restaurantId: a.restaurantId, kind })
    .sort(kind === 'queue' ? 'createdAt' : 'bookingAt')
    .limit(500)
    .lean();
  const customerRestaurantId = await getCustomerRestaurantIdForStaff(a);
  const merged: unknown[] = [...staffParties.map(p => ({ ...p, synthetic: false }))];
  if (kind === 'reservation') {
    const resos = await scopedReservationsCursor(customerRestaurantId, { includeAllStatuses: true });
    for (const r of resos) merged.push(await reservationToPartyDTO(r));
  } else {
    const queues = await scopedQueueCursor(customerRestaurantId);
    for (const q of queues) merged.push(await queueEntryToPartyDTO(q));
  }
  merged.sort((x: any, y: any) => {
    const ax = kind === 'queue' ? (x.createdAt || x.joinedAt || 0).getTime ? (x.createdAt || x.joinedAt).getTime() : Number(x.createdAt || x.joinedAt || 0) : (x.bookingAt?.getTime ? x.bookingAt.getTime() : Number(x.bookingAt || 0));
    const by = kind === 'queue' ? (y.createdAt || y.joinedAt || 0).getTime ? (y.createdAt || y.joinedAt).getTime() : Number(y.createdAt || y.joinedAt || 0) : (y.bookingAt?.getTime ? y.bookingAt.getTime() : Number(y.bookingAt || 0));
    return ax - by;
  });
  res.json(merged.slice(0, 500));
}));
staffRoutes.get('/parties/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  const a = account(res);
  const prefix = isSyntheticId(id);
  if (prefix) {
    const customerRestaurantId = await getCustomerRestaurantIdForStaff(a);
    if (prefix === 'res') {
      const r = await findResoUnderStaff(id, customerRestaurantId);
      res.json(await reservationToPartyDTO(r));
      return;
    } else {
      const q = await findQueueUnderStaff(id, customerRestaurantId);
      res.json(await queueEntryToPartyDTO(q));
      return;
    }
  }
  res.json(await findParty(a, id));
}));
staffRoutes.post('/parties', wrap(async (req, res) => {
  const a = account(res), input = partyInput(req.body);
  const kind = req.body.kind;
  if (!['queue', 'reservation'].includes(kind)) throw new StaffError(400, 'Choose queue or reservation.');
  const requestId = text(req.header('Idempotency-Key'), 'Request key');
  const bookingAt = kind === 'reservation' ? bookingTime(req.body.bookingAt) : undefined;
  let result;
  await mongoose.connection.transaction(async session => {
    const existing = await StaffParty.findOne({ restaurantId: a.restaurantId, requestId }).session(session);
    if (existing) { result = existing; return; }
    const number = `${kind === 'queue' ? 'Q' : 'R'}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const [p] = await StaffParty.create([{ ...input, restaurantId: a.restaurantId, kind, bookingAt, status: kind === 'queue' ? 'waiting' : 'upcoming', number, requestId, createdBy: a._id }], { session });
    await record(a, `${number} ${kind === 'queue' ? 'added to queue' : 'reservation created'}`, kind === 'queue' ? 'Queue' : 'Reservations', session, p._id);
    result = p;
  });
  res.status(201).json(result);
}));
staffRoutes.patch('/parties/:id', wrap(async (req, res) => {
  const a = account(res); let result;
  const id = String(req.params.id);
  const prefix = isSyntheticId(id);
  if (prefix) {
    const customerRestaurantId = await getCustomerRestaurantIdForStaff(a);
    const action = req.body.action;
    await mongoose.connection.transaction(async session => {
      if (prefix === 'res') {
        const r = await findResoUnderStaff(id, customerRestaurantId);
        const userId = typeof r.userId === 'object' ? String((r.userId as any)._id || r.userId) : String(r.userId);
        const numberLabel = `R-${String(r._id).slice(-6).toUpperCase()}`;
        if (r.status === 'cancelled' || r.status === 'completed') throw new StaffError(409, 'This entry is already closed.');
        if (action === 'edit') {
          const input = partyInput(req.body);
          r.guests = input.partySize;
          r.specialRequests = input.specialRequests;
          if (req.body.bookingAt && typeof req.body.bookingAt === 'string') {
            const dt = new Date(req.body.bookingAt);
            if (Number.isFinite(dt.getTime())) {
              const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, '0'); const d = String(dt.getDate()).padStart(2, '0');
              const hh = String(dt.getHours()).padStart(2, '0'); const mm = String(dt.getMinutes()).padStart(2, '0');
              r.date = `${y}-${m}-${d}`; r.time = `${hh}:${mm}`;
            }
          }
          await r.save({ session });
          await record(a, `${numberLabel}: edit`, 'Reservations', session, syntheticPartyId(r._id));
          void emitCustomerNotificationForStaffAction({
            userId, reservationId: r._id,
            type: 'reservation_modified',
            title: 'Reservation Updated',
            message: `Your reservation has been updated to ${r.date} at ${r.time} for ${r.guests} guests.`,
          });
          result = await reservationToPartyDTO(r);
        } else if (action === 'arrived') {
          if (r.status !== 'confirmed' && r.status !== 'pending') throw new StaffError(409, 'This reservation is not in an arrived-able state.');
          r.status = 'confirmed';
          await r.save({ session });
          await record(a, `${numberLabel}: arrived`, 'Reservations', session, syntheticPartyId(r._id));
          result = await reservationToPartyDTO(r);
        } else if (action === 'cancel' || action === 'no-show') {
          r.status = 'cancelled'; r.cancelledAt = new Date();
          await r.save({ session });
          await record(a, `${numberLabel}: ${action}`, 'Reservations', session, syntheticPartyId(r._id));
          void emitCustomerNotificationForStaffAction({
            userId, reservationId: r._id,
            type: 'reservation_cancelled',
            title: action === 'no-show' ? 'Reservation Marked No-Show' : 'Reservation Cancelled',
            message: `Your reservation for ${r.date} at ${r.time} has been ${action === 'no-show' ? 'marked as no-show' : 'cancelled'}.`,
          });
          result = await reservationToPartyDTO(r);
        } else if (action === 'extend') {
          await record(a, `${numberLabel}: extend (no-op for customer reservations)`, 'Reservations', session, syntheticPartyId(r._id));
          result = await reservationToPartyDTO(r);
        } else throw new StaffError(400, 'This action is not available for this entry.');
      } else {
        const q = await findQueueUnderStaff(id, customerRestaurantId);
        const userId = typeof q.userId === 'object' ? String((q.userId as any)._id || q.userId) : String(q.userId);
        const numberLabel = `Q-${String(q.queueNumber).padStart(3, '0')}`;
        if (q.status === 'cancelled' || q.status === 'seated') throw new StaffError(409, 'This entry is already closed.');
        if (action === 'edit') {
          const input = partyInput(req.body);
          q.guests = input.partySize;
          q.specialRequests = input.specialRequests;
          await q.save({ session });
          await record(a, `${numberLabel}: edit`, 'Queue', session, syntheticQueueId(q._id));
          result = await queueEntryToPartyDTO(q);
        } else if (action === 'arrived' && q.status === 'waiting') {
          q.status = 'called'; q.calledAt = new Date();
          await q.save({ session });
          await record(a, `${numberLabel}: called to stand (arrived)`, 'Queue', session, syntheticQueueId(q._id));
          void emitCustomerNotificationForStaffAction({
            userId, queueEntryId: q._id,
            type: 'queue_status_changed',
            title: 'Please Return to Host Stand',
            message: `Your party ${numberLabel} has been called. Please return to the host stand.`,
          });
          result = await queueEntryToPartyDTO(q);
        } else if (action === 'cancel' || action === 'no-show') {
          q.status = 'cancelled'; q.cancelledAt = new Date();
          await q.save({ session });
          await recalculatePositions(q.restaurantId);
          await record(a, `${numberLabel}: ${action}`, 'Queue', session, syntheticQueueId(q._id));
          void emitCustomerNotificationForStaffAction({
            userId, queueEntryId: q._id,
            type: 'queue_cancelled',
            title: action === 'no-show' ? 'Removed From Queue (No-Show)' : 'Removed From Queue',
            message: `Your party ${numberLabel} has been ${action === 'no-show' ? 'marked no-show and removed' : 'cancelled and removed'} from the queue.`,
          });
          result = await queueEntryToPartyDTO(q);
        } else if (action === 'extend') {
          await record(a, `${numberLabel}: extend (no-op for queue entries)`, 'Queue', session, syntheticQueueId(q._id));
          result = await queueEntryToPartyDTO(q);
        } else throw new StaffError(400, 'This action is not available for this entry.');
      }
    });
    res.json(result);
    return;
  }
  await mongoose.connection.transaction(async session => {
    const p = await findParty(a, String(req.params.id), session);
    if (terminalStatuses.includes(p.status)) throw new StaffError(409, 'This entry is already closed.');
    const action = req.body.action;
    if (action === 'edit') {
      const input = partyInput(req.body);
      if (p.tableId) {
        const t = await findTable(a, p.tableId, session);
        if (input.partySize > t.capacity) throw new StaffError(409, 'The assigned table cannot fit the new party size.');
        if (p.kind === 'reservation' && new Date(String(req.body.bookingAt)).getTime() !== p.bookingAt?.getTime()) throw new StaffError(409, 'Cancel this table hold before changing the booking time.');
      }
      Object.assign(p, input);
      if (p.kind === 'reservation' && !p.tableId) p.bookingAt = bookingTime(req.body.bookingAt);
    } else if (action === 'arrived' && p.kind === 'reservation' && p.status === 'upcoming') p.status = 'arrived';
    else if (action === 'cancel' || (action === 'no-show' && p.kind === 'reservation')) {
      if (p.tableId) await StaffTable.updateOne({ _id: p.tableId, restaurantId: a.restaurantId, partyId: p._id, status: 'reserved' }, { $set: { status: 'available', partyId: null, holdExpiresAt: null } }, { session });
      p.status = action === 'cancel' ? 'cancelled' : 'no-show'; p.cancelledAt = new Date(); p.tableId = null; p.holdExpiresAt = null;
    } else if (action === 'extend' && p.tableId && p.holdExpiresAt && p.holdExpiresAt > new Date()) {
      const t = await findTable(a, p.tableId, session);
      if (t.status !== 'reserved' || t.partyId !== p._id) throw new StaffError(409, 'The table hold is no longer active.');
      p.holdExpiresAt = new Date(p.holdExpiresAt.getTime() + 10 * 60000); t.holdExpiresAt = p.holdExpiresAt; await t.save({ session });
    } else throw new StaffError(400, 'This action is not available for this entry.');
    await p.save({ session });
    await record(a, `${p.number}: ${action}`, p.kind === 'queue' ? 'Queue' : 'Reservations', session, p._id);
    result = p;
  }); res.json(result);
}));
staffRoutes.get('/tables', wrap(async (_req, res) => { res.json(await StaffTable.find({ restaurantId: account(res).restaurantId }).sort('number')); }));
staffRoutes.get('/tables/:id', wrap(async (req, res) => { res.json(await findTable(account(res), String(req.params.id))); }));
staffRoutes.patch('/tables/:id', wrap(async (req, res) => {
  const a = account(res), status = req.body.status;
  if (!['available', 'occupied', 'reserved', 'cleaning'].includes(status)) throw new StaffError(400, 'Invalid table status.');
  let result;
  await mongoose.connection.transaction(async session => {
    const t = await findTable(a, String(req.params.id), session);
    if (t.status === status) { result = t; return; }
    if (t.partyId && t.status === 'reserved') throw new StaffError(409, 'Manage this reservation hold through the customer entry.');
    if (t.partyId && t.status === 'occupied' && status !== 'cleaning') throw new StaffError(409, 'Mark an occupied table as cleaning before making it available.');
    if (status === 'occupied' && t.status !== 'available') throw new StaffError(409, 'Only available tables can be occupied.');
    if (status === 'reserved') throw new StaffError(400, 'Select a reservation using Assign Table to create a timed hold.');
    t.status = status; t.partyId = null; t.holdExpiresAt = null; await t.save({ session });
    await record(a, `Table ${t.number} marked ${status}`, 'System', session, undefined, t._id); result = t;
  }); res.json(result);
}));
staffRoutes.post('/assign', wrap(async (req, res) => {
  const a = account(res), mode = req.body.mode === 'hold' ? 'hold' : 'seat'; let result;
  const rawPartyId = text(req.body.partyId, 'Customer entry');
  const prefix = isSyntheticId(rawPartyId);
  if (prefix) {
    const customerRestaurantId = await getCustomerRestaurantIdForStaff(a);
    await mongoose.connection.transaction(async session => {
      const t = await findTable(a, text(req.body.tableId, 'Table'), session);
      let sourceKind: 'queue' | 'reservation' = prefix === 'res' ? 'reservation' : 'queue';
      let partyNumber = '';
      let customerUserId: string | Types.ObjectId = '';
      let customerReservationId: Types.ObjectId | null = null;
      let customerQueueId: Types.ObjectId | null = null;
      if (prefix === 'res') {
        const r = await findResoUnderStaff(rawPartyId, customerRestaurantId);
        customerReservationId = r._id;
        customerUserId = typeof r.userId === 'object' ? (r.userId as any)._id || r.userId : r.userId;
        partyNumber = `R-${String(r._id).slice(-6).toUpperCase()}`;
        if (mode === 'seat') {
          if (r.status === 'cancelled' || r.status === 'completed') throw new StaffError(409, 'This reservation is already closed.');
          if (t.capacity < r.guests) throw new StaffError(409, 'This table is too small for the party.');
          r.status = 'completed';
          await r.save({ session });
          void emitCustomerNotificationForStaffAction({
            userId: customerUserId, reservationId: r._id,
            type: 'reservation_modified',
            title: 'You Have Been Seated',
            message: `Your reservation party ${partyNumber} has been seated at table ${t.number}.`,
          });
        } else if (mode === 'hold') {
          partyNumber = `R-${String(r._id).slice(-6).toUpperCase()}`;
        }
        sourceKind = 'reservation';
      } else {
        const q = await findQueueUnderStaff(rawPartyId, customerRestaurantId);
        customerQueueId = q._id;
        customerUserId = typeof q.userId === 'object' ? (q.userId as any)._id || q.userId : q.userId;
        partyNumber = `Q-${String(q.queueNumber).padStart(3, '0')}`;
        if (q.status === 'cancelled' || q.status === 'seated') throw new StaffError(409, 'This queue entry is already closed.');
        if (t.capacity < q.guests) throw new StaffError(409, 'This table is too small for the party.');
        if (mode === 'hold') throw new StaffError(400, 'Timed holds are for reservations.');
        q.status = 'seated'; q.seatedAt = new Date();
        await q.save({ session });
        await recalculatePositions(q.restaurantId);
        void emitCustomerNotificationForStaffAction({
          userId: customerUserId, queueEntryId: q._id,
          type: 'queue_status_changed',
          title: 'You Have Been Seated',
          message: `Your queue party ${partyNumber} has been seated at table ${t.number}.`,
        });
        sourceKind = 'queue';
      }
      if (t.status !== 'available') throw new StaffError(409, 'This table is no longer available.');
      t.status = mode === 'hold' ? 'reserved' : 'occupied';
      t.partyId = rawPartyId;
      if (mode === 'hold') t.holdExpiresAt = new Date(Date.now() + 10 * 60000);
      await t.save({ session });
      await record(a, `${partyNumber} ${mode === 'hold' ? 'held at' : 'assigned to'} ${t.number}`, sourceKind === 'queue' ? 'Queue' : 'Reservations', session, rawPartyId, t._id);
      result = t;
    }); res.json(result); return;
  }
  await mongoose.connection.transaction(async session => {
    const p = await findParty(a, rawPartyId, session);
    const t = await findTable(a, text(req.body.tableId, 'Table'), session);
    if (p.status === 'seated' && p.tableId === t._id && t.partyId === p._id && mode === 'seat') { result = t; return; }
    if (terminalStatuses.includes(p.status)) throw new StaffError(409, 'This entry is already closed.');
    if (t.capacity < p.partySize) throw new StaffError(409, 'This table is too small for the party.');
    if (t.status !== 'available' && !(t.status === 'reserved' && t.partyId === p._id)) throw new StaffError(409, 'This table is no longer available.');
    if (t.status === 'reserved' && t.holdExpiresAt && t.holdExpiresAt <= new Date()) throw new StaffError(409, 'The table hold has expired. Refresh before assigning.');
    if (p.tableId && p.tableId !== t._id) throw new StaffError(409, 'This customer already has a table assigned.');
    if (mode === 'hold' && p.kind !== 'reservation') throw new StaffError(400, 'Timed holds are for reservations.');
    if (mode === 'hold' && t.partyId === p._id) { result = t; return; }
    p.tableId = t._id; t.partyId = p._id;
    const expiry = mode === 'hold' ? new Date(Math.max(Date.now(), p.bookingAt?.getTime() || Date.now()) + 10 * 60000) : null;
    t.status = mode === 'hold' ? 'reserved' : 'occupied'; t.holdExpiresAt = expiry; p.holdExpiresAt = expiry;
    if (mode === 'seat') { p.status = 'seated'; p.seatedAt = new Date(); }
    await t.save({ session }); await p.save({ session });
    await record(a, `${p.number} ${mode === 'hold' ? 'held at' : 'assigned to'} ${t.number}`, p.kind === 'queue' ? 'Queue' : 'Reservations', session, p._id, t._id); result = t;
  }); res.json(result);
}));
staffRoutes.post('/alerts', wrap(async (req, res) => {
  const a = account(res), requestId = text(req.header('Idempotency-Key'), 'Request key'); let result;
  const rawPartyId = text(req.body.partyId, 'Customer entry');
  const prefix = isSyntheticId(rawPartyId);
  if (prefix) {
    const customerRestaurantId = await getCustomerRestaurantIdForStaff(a);
    await mongoose.connection.transaction(async session => {
      const old = await StaffAlert.findOne({ restaurantId: a.restaurantId, requestId }).session(session);
      if (old) { result = old; return; }
      const stage = req.body.stage === 'almost-ready' ? 'almost-ready' : 'ready';
      let partyNumber = '';
      let sourceKind: 'Queue' | 'Reservations' = 'Reservations';
      let customerUserId: string | Types.ObjectId = '';
      let customerReservationId: Types.ObjectId | null = null;
      let customerQueueId: Types.ObjectId | null = null;
      let partyStatus: string = '';
      if (prefix === 'res') {
        const r = await findResoUnderStaff(rawPartyId, customerRestaurantId);
        if (r.status === 'cancelled' || r.status === 'completed') throw new StaffError(409, 'This reservation is already closed.');
        customerReservationId = r._id;
        customerUserId = typeof r.userId === 'object' ? (r.userId as any)._id || r.userId : r.userId;
        partyNumber = `R-${String(r._id).slice(-6).toUpperCase()}`;
        partyStatus = r.status;
        sourceKind = 'Reservations';
        if (stage === 'ready') {
          const suitable = await StaffTable.findOne({ restaurantId: a.restaurantId, capacity: { $gte: r.guests }, status: 'available' }).session(session);
          if (!suitable) throw new StaffError(409, 'There is no suitable available table yet. Send an early alert instead.');
        }
      } else {
        const q = await findQueueUnderStaff(rawPartyId, customerRestaurantId);
        if (q.status === 'cancelled' || q.status === 'seated') throw new StaffError(409, 'This queue entry is already closed.');
        customerQueueId = q._id;
        customerUserId = typeof q.userId === 'object' ? (q.userId as any)._id || q.userId : q.userId;
        partyNumber = `Q-${String(q.queueNumber).padStart(3, '0')}`;
        partyStatus = q.status;
        sourceKind = 'Queue';
        if (stage === 'ready') {
          const suitable = await StaffTable.findOne({ restaurantId: a.restaurantId, capacity: { $gte: q.guests }, status: 'available' }).session(session);
          if (!suitable) throw new StaffError(409, 'There is no suitable available table yet. Send an early alert instead.');
        }
        if (stage === 'ready') {
          q.status = 'called'; q.calledAt = new Date();
          await q.save({ session });
        }
      }
      const message = stage === 'ready' ? `Your table is ready. Please return to the host stand (${partyNumber}).` : `Your table will be ready shortly. Please stay nearby (${partyNumber}).`;
      const [alert] = await StaffAlert.create([{ restaurantId: a.restaurantId, partyId: rawPartyId, tableId: undefined, message, requestId, channel: 'in-app' }], { session });
      await record(a, `${partyNumber}: ${stage === 'ready' ? 'table-ready' : 'early'} alert recorded`, sourceKind, session, rawPartyId, undefined);
      if (prefix === 'que') {
        void emitCustomerNotificationForStaffAction({
          userId: customerUserId, queueEntryId: customerQueueId,
          type: stage === 'ready' ? 'queue_next' : 'queue_status_changed',
          title: stage === 'ready' ? 'Your Table Is Ready!' : 'Your Table Will Be Ready Shortly',
          message: message,
        });
      } else {
        void emitCustomerNotificationForStaffAction({
          userId: customerUserId, reservationId: customerReservationId,
          type: 'reservation_modified',
          title: stage === 'ready' ? 'Your Table Is Ready!' : 'Your Table Will Be Ready Shortly',
          message: message,
        });
      }
      result = alert;
    });
    res.status(201).json(result);
    return;
  }
  await mongoose.connection.transaction(async session => {
    const old = await StaffAlert.findOne({ restaurantId: a.restaurantId, requestId }).session(session);
    if (old) { result = old; return; }
    const p = await findParty(a, rawPartyId, session);
    if (terminalStatuses.includes(p.status)) throw new StaffError(409, 'This entry is already closed.');
    const stage = req.body.stage === 'almost-ready' ? 'almost-ready' : 'ready';
    if (stage === 'ready') {
      const suitable = await StaffTable.findOne({ restaurantId: a.restaurantId, capacity: { $gte: p.partySize }, $or: [{ status: 'available' }, { status: 'reserved', partyId: p._id, holdExpiresAt: { $gt: new Date() } }] }).session(session);
      if (!suitable) throw new StaffError(409, 'There is no suitable available table yet. Send an early alert instead.');
    }
    const message = stage === 'ready' ? `Your table is ready. Please return to the host stand (${p.number}).` : `Your table will be ready shortly. Please stay nearby (${p.number}).`;
    if (p.kind === 'queue') p.status = stage;
    await p.save({ session });
    const [alert] = await StaffAlert.create([{ restaurantId: a.restaurantId, partyId: p._id, tableId: p.tableId, message, requestId, channel: 'in-app' }], { session });
    await record(a, `${p.number}: ${stage === 'ready' ? 'table-ready' : 'early'} alert recorded`, p.kind === 'queue' ? 'Queue' : 'Reservations', session, p._id, p.tableId || undefined); result = alert;
  }); res.status(201).json(result);
}));
staffRoutes.get('/notifications', wrap(async (_req, res) => {
  const a = account(res);
  const categories: ('System' | 'Queue' | 'Reservations')[] = ['System'];
  if (a.settings?.queueAlerts !== false) categories.push('Queue');
  if (a.settings?.reservationAlerts !== false) categories.push('Reservations');
  const items = await StaffNotification.find({ restaurantId: a.restaurantId, category: { $in: categories } }).sort('-createdAt').limit(200).lean();
  res.json(items.map(n => ({ ...n, read: n.readBy.includes(a._id) })));
}));
staffRoutes.patch('/notifications/:id/read', wrap(async (req, res) => {
  const a = account(res);
  const n = await StaffNotification.findOneAndUpdate({ _id: String(req.params.id), restaurantId: a.restaurantId }, { $addToSet: { readBy: a._id } }, { returnDocument: 'after' });
  if (!n) throw new StaffError(404, 'Notification not found.'); res.json(n);
}));
staffRoutes.get('/restaurant-photo', wrap(async (_req, res) => {
  const a = account(res);
  const { customerRestaurant } = await resolveStaffRestaurant(a);
  res.json({
    success: true,
    restaurantId: String(customerRestaurant._id),
    restaurantName: customerRestaurant.name,
    photoFileId: customerRestaurant.photoFileId ? String(customerRestaurant.photoFileId) : null,
    photoUrl: customerRestaurant.imageUrl || null,
  });
}));
staffRoutes.put('/restaurant-photo', (req, res, next) => {
  upload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Photo exceeds the 5 MB limit.' });
        return;
      }
      const message = err?.message || 'Unable to process the uploaded file.';
      if (/Only|allowed/i.test(message)) {
        res.status(400).json({ error: message });
      } else {
        res.status(400).json({ error: message });
      }
      return;
    }
    void (async () => {
      try {
        const a = account(res);
        const file = (req as any).file;
        if (!file) throw new StaffError(400, 'No photo file selected.');
        if (!file.buffer || file.buffer.length === 0) throw new StaffError(400, 'Uploaded file is empty.');
        const { customerRestaurant } = await resolveStaffRestaurant(a);
        const stored = await storePhoto(file.buffer, {
          filename: `restaurant-${customerRestaurant._id}-${Date.now()}`,
          contentType: file.mimetype || 'image/jpeg',
          restaurantId: String(customerRestaurant._id),
        });
        const previousFileId = customerRestaurant.photoFileId;
        customerRestaurant.photoFileId = stored._id;
        customerRestaurant.imageUrl = `/api/restaurants/${customerRestaurant._id}/photo`;
        await customerRestaurant.save();
        if (previousFileId) await deleteFileIfExists(previousFileId);
        res.json({
          success: true,
          restaurantId: String(customerRestaurant._id),
          restaurantName: customerRestaurant.name,
          photoFileId: String(stored._id),
          photoUrl: customerRestaurant.imageUrl,
        });
      } catch (cause) { next(cause); }
    })();
  });
});
staffRoutes.delete('/restaurant-photo', wrap(async (_req, res) => {
  const a = account(res);
  const { customerRestaurant } = await resolveStaffRestaurant(a);
  const previousFileId = customerRestaurant.photoFileId;
  customerRestaurant.photoFileId = null;
  customerRestaurant.imageUrl = null;
  await customerRestaurant.save();
  if (previousFileId) await deleteFileIfExists(previousFileId);
  res.json({ success: true, message: 'Photo removed.' });
}));
staffRoutes.get('/activity', wrap(async (req, res) => {
  const filter: Record<string, unknown> = { restaurantId: account(res).restaurantId };
  if (req.query.tableId) filter.tableId = String(req.query.tableId);
  if (req.query.partyId) filter.partyId = String(req.query.partyId);
  res.json(await StaffEvent.find(filter).sort('-createdAt').limit(200));
}));
staffRoutes.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof StaffError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof SyntheticAccessError) { res.status(error.statusCode).json({ error: error.message }); return; }
  if ((error as { code?: number })?.code === 11000) { res.status(409).json({ error: 'That request has already been saved. Refresh before retrying.' }); return; }
  console.error('Staff API error:', error instanceof Error ? error.name : 'Unknown error');
  res.status(500).json({ error: 'Unable to complete the action. Please try again.' });
});
