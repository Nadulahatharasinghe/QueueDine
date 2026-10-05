import { Router, Request, Response, NextFunction } from 'express';
import mongoose, { ClientSession, HydratedDocument, InferSchemaType } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { StaffAccount, StaffSession, StaffRestaurant, StaffTable, StaffParty, StaffEvent, StaffNotification, StaffAlert } from './models';
import { StaffError, text, partyInput, bookingTime, waitEstimate, terminalStatuses } from './domain';

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
staffRoutes.get('/dashboard', wrap(async (_req, res) => {
  const a = account(res);
  const tables = await StaffTable.find({ restaurantId: a.restaurantId }).sort('number');
  const waiting = await StaffParty.countDocuments({ restaurantId: a.restaurantId, kind: 'queue', status: { $in: ['waiting', 'almost-ready', 'ready'] } });
  const available = tables.filter(t => t.status === 'available').length;
  const next = await StaffParty.findOne({ restaurantId: a.restaurantId, status: { $in: ['waiting', 'almost-ready', 'ready', 'arrived'] } }).sort('createdAt');
  const unread = await StaffNotification.countDocuments({ restaurantId: a.restaurantId, readBy: { $ne: a._id } });
  res.json({ user: profile(a), restaurant: await StaffRestaurant.findById(a.restaurantId), tables, waiting, estimate: waitEstimate(waiting, available), next, unread });
}));
staffRoutes.get('/parties', wrap(async (req, res) => {
  const kind = req.query.kind === 'reservation' ? 'reservation' : 'queue';
  res.json(await StaffParty.find({ restaurantId: account(res).restaurantId, kind }).sort(kind === 'queue' ? 'createdAt' : 'bookingAt').limit(500));
}));
staffRoutes.get('/parties/:id', wrap(async (req, res) => { res.json(await findParty(account(res), String(req.params.id))); }));
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
  await mongoose.connection.transaction(async session => {
    const p = await findParty(a, text(req.body.partyId, 'Customer entry'), session);
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
  await mongoose.connection.transaction(async session => {
    const old = await StaffAlert.findOne({ restaurantId: a.restaurantId, requestId }).session(session);
    if (old) { result = old; return; }
    const p = await findParty(a, text(req.body.partyId, 'Customer entry'), session);
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
staffRoutes.get('/activity', wrap(async (req, res) => {
  const filter: Record<string, unknown> = { restaurantId: account(res).restaurantId };
  if (req.query.tableId) filter.tableId = String(req.query.tableId);
  if (req.query.partyId) filter.partyId = String(req.query.partyId);
  res.json(await StaffEvent.find(filter).sort('-createdAt').limit(200));
}));
staffRoutes.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof StaffError) { res.status(error.status).json({ error: error.message }); return; }
  if ((error as { code?: number })?.code === 11000) { res.status(409).json({ error: 'That request has already been saved. Refresh before retrying.' }); return; }
  console.error('Staff API error:', error instanceof Error ? error.name : 'Unknown error');
  res.status(500).json({ error: 'Unable to complete the action. Please try again.' });
});
