import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { StaffAccount, StaffSession, StaffRestaurant, StaffTable, StaffParty, StaffNotification } from '../staff/models';
import { StaffError, text } from '../staff/domain';
import { StaffReport } from './models';
import {
  getManagerDashboardData,
  getOccupancyAnalyticsData,
  getQueueAnalyticsData,
  getWalkawaysAnalyticsData,
  computeDailyReportMetrics,
  getTodayDateStr,
} from './analytics';

export const managerRoutes = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next); };

const secret = () => {
  const value = process.env.STAFF_JWT_SECRET || process.env.JWT_SECRET;
  if (!value) throw new StaffError(503, 'Staff authentication is not configured.');
  return value;
};

// Manager Authentication & Authorization Middleware
managerRoutes.use(wrap(async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new StaffError(401, 'Manager sign-in required.');
    const payload = jwt.verify(token, secret(), { audience: 'queuedine-staff' }) as jwt.JwtPayload;
    const session = await StaffSession.findOne({ _id: payload.sessionId, accountId: payload.accountId, expiresAt: { $gt: new Date() } });
    const account = session && await StaffAccount.findOne({ _id: session.accountId, isActive: true });
    if (!account) throw new StaffError(401, 'Your session has expired. Please sign in again.');
    if (account.role !== 'manager') {
      throw new StaffError(403, 'Access denied. Manager permissions required.');
    }
    res.locals.staff = account;
    res.locals.sessionId = session._id;
    next();
  } catch (error) {
    if (error instanceof StaffError) throw error;
    throw new StaffError(401, 'Invalid or expired manager session.');
  }
}));

// 1. Manager Dashboard
managerRoutes.get('/dashboard', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const range = typeof req.query.range === 'string' ? req.query.range : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const data = await getManagerDashboardData(staff.restaurantId, range || date || 'today', from, to);
  const restaurant = await StaffRestaurant.findById(staff.restaurantId);
  res.json({ ...data, restaurant, user: { fullName: staff.fullName, staffId: staff.staffId, role: staff.role } });
}));

// 2. Live Operations / Table Overview
managerRoutes.get('/live-overview', wrap(async (_req, res) => {
  const staff = res.locals.staff;
  const tables = await StaffTable.find({ restaurantId: staff.restaurantId }).sort('number');
  const queueParties = await StaffParty.find({
    restaurantId: staff.restaurantId,
    kind: 'queue',
    status: { $in: ['waiting', 'almost-ready', 'ready'] },
  }).sort('createdAt');
  res.json({ tables, queueParties });
}));

// 3. Occupancy Analytics
managerRoutes.get('/analytics/occupancy', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const range = typeof req.query.range === 'string' ? req.query.range : 'last-7-days';
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(await getOccupancyAnalyticsData(staff.restaurantId, range, from, to));
}));

// 4. Queue Analytics
managerRoutes.get('/analytics/queue', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const range = typeof req.query.range === 'string' ? req.query.range : 'today';
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(await getQueueAnalyticsData(staff.restaurantId, range, from, to));
}));

// 5. Walkaways & No-shows Analytics
managerRoutes.get('/analytics/walkaways', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const range = typeof req.query.range === 'string' ? req.query.range : 'last-7-days';
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(await getWalkawaysAnalyticsData(staff.restaurantId, range, from, to));
}));

// 6. Reservations View
managerRoutes.get('/reservations', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const tab = req.query.tab === 'past' ? 'past' : 'upcoming';
  const filter: Record<string, unknown> = {
    restaurantId: staff.restaurantId,
    kind: 'reservation',
  };
  if (tab === 'past') {
    filter.status = { $in: ['seated', 'cancelled', 'no-show'] };
  } else {
    filter.status = { $in: ['upcoming', 'arrived', 'waiting', 'almost-ready', 'ready'] };
  }
  const reservations = await StaffParty.find(filter).sort('bookingAt');
  res.json(reservations);
}));

// 7. Daily Report Preview (End of Day summary)
managerRoutes.get('/reports/daily', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const date = typeof req.query.date === 'string' ? req.query.date : getTodayDateStr();
  const existing = await StaffReport.findOne({ restaurantId: staff.restaurantId, date });
  if (existing) {
    res.json(existing);
    return;
  }
  const calculated = await computeDailyReportMetrics(staff.restaurantId, date, staff.staffId);
  res.json(calculated);
}));

// 8. CREATE Report (Generate & Save Report)
managerRoutes.post('/reports', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const date = text(req.body.date, 'Report date', 20);
  const calculated = await computeDailyReportMetrics(staff.restaurantId, date, staff.staffId);
  const report = await StaffReport.findOneAndUpdate(
    { restaurantId: staff.restaurantId, date },
    { $set: { ...calculated, notes: req.body.notes || '' } },
    { upsert: true, returnDocument: 'after' }
  );
  res.status(201).json(report);
}));

// 9. READ Report History
managerRoutes.get('/reports', wrap(async (_req, res) => {
  const staff = res.locals.staff;
  const reports = await StaffReport.find({ restaurantId: staff.restaurantId }).sort('-date').limit(100);
  res.json(reports);
}));

// 10. READ Single Report Details
managerRoutes.get('/reports/:id', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const report = await StaffReport.findOne({ _id: String(req.params.id), restaurantId: staff.restaurantId });
  if (!report) throw new StaffError(404, 'Report not found.');
  res.json(report);
}));

// 11. DELETE Saved Report
managerRoutes.delete('/reports/:id', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const deleted = await StaffReport.findOneAndDelete({ _id: String(req.params.id), restaurantId: staff.restaurantId });
  if (!deleted) throw new StaffError(404, 'Report not found.');
  res.sendStatus(204);
}));

// 12. UPDATE Saved Report Notes
managerRoutes.patch('/reports/:id', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const updated = await StaffReport.findOneAndUpdate(
    { _id: String(req.params.id), restaurantId: staff.restaurantId },
    { $set: { notes: String(req.body.notes || '').slice(0, 500) } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new StaffError(404, 'Report not found.');
  res.json(updated);
}));

// 13. Manager Notifications
managerRoutes.get('/notifications', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const category = req.query.category;
  const filter: Record<string, unknown> = { restaurantId: staff.restaurantId };
  if (category && ['Operations', 'System'].includes(String(category))) {
    filter.category = category === 'Operations' ? { $in: ['Queue', 'Reservations'] } : 'System';
  }
  const notifications = await StaffNotification.find(filter).sort('-createdAt').limit(50).lean();
  res.json(notifications.map(n => ({ ...n, read: n.readBy.includes(staff._id) })));
}));

// 14. Mark Notification as Read
managerRoutes.patch('/notifications/:id/read', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const n = await StaffNotification.findOneAndUpdate(
    { _id: String(req.params.id), restaurantId: staff.restaurantId },
    { $addToSet: { readBy: staff._id } },
    { returnDocument: 'after' }
  );
  if (!n) throw new StaffError(404, 'Notification not found.');
  res.json(n);
}));

// 15. GET Manager Profile
managerRoutes.get('/profile', wrap(async (_req, res) => {
  const staff = res.locals.staff;
  const restaurant = await StaffRestaurant.findById(staff.restaurantId);
  res.json({
    _id: staff._id,
    staffId: staff.staffId,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    restaurantId: staff.restaurantId,
    restaurantName: restaurant?.name || 'Ember & Oak',
    restaurantLocation: restaurant?.location || 'Colombo',
    onDuty: staff.onDuty,
    shiftStart: staff.shiftStart,
    shiftEnd: staff.shiftEnd,
    createdAt: staff.createdAt,
  });
}));

// 16. UPDATE Manager Profile (Full Name, Email)
managerRoutes.patch('/profile', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : undefined;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

  if (fullName !== undefined && (!fullName || fullName.length < 2)) {
    throw new StaffError(400, 'Full name must be at least 2 characters.');
  }

  if (email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new StaffError(400, 'Please provide a valid email address.');
    }
    const existing = await StaffAccount.findOne({ email, _id: { $ne: staff._id } });
    if (existing) {
      throw new StaffError(409, 'An account with this email address already exists.');
    }
  }

  const updates: Record<string, unknown> = {};
  if (fullName) updates.fullName = fullName;
  if (email) updates.email = email;

  const updated = await StaffAccount.findByIdAndUpdate(
    staff._id,
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!updated) throw new StaffError(404, 'Account not found.');

  res.json({
    _id: updated._id,
    staffId: updated.staffId,
    fullName: updated.fullName,
    email: updated.email,
    role: updated.role,
    restaurantId: updated.restaurantId,
    onDuty: updated.onDuty,
    shiftStart: updated.shiftStart,
    shiftEnd: updated.shiftEnd,
  });
}));

// 17. CHANGE Manager Password
managerRoutes.post('/change-password', wrap(async (req, res) => {
  const staff = res.locals.staff;
  const currentPassword = text(req.body.currentPassword, 'Current password', 200);
  const newPassword = text(req.body.newPassword, 'New password', 200);

  if (newPassword.length < 6) {
    throw new StaffError(400, 'New password must be at least 6 characters long.');
  }

  const accountWithPass = await StaffAccount.findById(staff._id).select('+passwordHash');
  if (!accountWithPass) throw new StaffError(404, 'Account not found.');

  const isValid = await bcrypt.compare(currentPassword, accountWithPass.passwordHash);
  if (!isValid) {
    throw new StaffError(401, 'Current password is incorrect.');
  }

  accountWithPass.passwordHash = await bcrypt.hash(newPassword, 12);
  await accountWithPass.save();

  res.json({ success: true, message: 'Password has been updated successfully.' });
}));

// Error Handling
managerRoutes.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof StaffError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Manager API error:', error instanceof Error ? error.message : 'Unknown error');
  res.status(500).json({ error: 'Unable to complete manager request. Please try again.' });
});
