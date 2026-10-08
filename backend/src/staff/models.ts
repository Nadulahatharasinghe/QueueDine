import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';

// Explicit collection names keep all existing customer collections untouched.
const id = { type: String, default: randomUUID };
const restaurantId = { type: String, required: true, index: true };
export const StaffRestaurant = mongoose.model('StaffRestaurant', new Schema({
  _id: id, name: { type: String, required: true }, location: String,
  timeZone: { type: String, default: 'Asia/Colombo' },
  customerRestaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', default: null, index: true },
}, { timestamps: true, collection: 'staff_restaurants' }));
export const StaffAccount = mongoose.model('StaffAccount', new Schema({
  _id: id, restaurantId, staffId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  fullName: { type: String, required: true }, passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['host', 'manager'], default: 'host' },
  isActive: { type: Boolean, default: true }, onDuty: { type: Boolean, default: true },
  shiftStart: String, shiftEnd: String,
  settings: { queueAlerts: { type: Boolean, default: true }, reservationAlerts: { type: Boolean, default: true } },
}, { timestamps: true, collection: 'staff_accounts' }));
export const StaffSession = mongoose.model('StaffSession', new Schema({
  _id: id, accountId: { type: String, required: true }, expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: 'staff_sessions' }));
const tableSchema = new Schema({
  _id: id, restaurantId, number: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 }, area: { type: String, enum: ['Main Area', 'Outdoor'], default: 'Main Area' },
  status: { type: String, enum: ['available', 'occupied', 'reserved', 'cleaning'], default: 'available' },
  partyId: { type: String, default: null }, holdExpiresAt: { type: Date, default: null },
}, { timestamps: true, collection: 'staff_tables' });
tableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });
export const StaffTable = mongoose.model('StaffTable', tableSchema);
const partySchema = new Schema({
  _id: id, restaurantId, number: { type: String, required: true },
  kind: { type: String, enum: ['queue', 'reservation'], required: true },
  customerName: { type: String, required: true }, mobileNumber: { type: String, required: true },
  partySize: { type: Number, required: true, min: 1, max: 30 }, specialRequests: { type: String, default: '' },
  status: { type: String, enum: ['waiting', 'almost-ready', 'ready', 'upcoming', 'arrived', 'seated', 'cancelled', 'no-show'], required: true },
  bookingAt: Date, tableId: { type: String, default: null }, holdExpiresAt: { type: Date, default: null },
  seatedAt: Date, cancelledAt: Date,
  requestId: { type: String, required: true }, createdBy: { type: String, required: true },
}, { timestamps: true, collection: 'staff_parties' });
partySchema.index({ restaurantId: 1, requestId: 1 }, { unique: true });
partySchema.index({ restaurantId: 1, number: 1 }, { unique: true });
export const StaffParty = mongoose.model('StaffParty', partySchema);
export const StaffEvent = mongoose.model('StaffEvent', new Schema({
  _id: id, restaurantId, actorName: String, message: { type: String, required: true },
  category: { type: String, enum: ['Queue', 'Reservations', 'System'], required: true },
  partyId: String, tableId: String,
}, { timestamps: true, collection: 'staff_events' }));
export const StaffNotification = mongoose.model('StaffNotification', new Schema({
  _id: id, restaurantId, message: { type: String, required: true },
  category: { type: String, enum: ['Queue', 'Reservations', 'System'], required: true },
  partyId: String, tableId: String, readBy: { type: [String], default: [] },
}, { timestamps: true, collection: 'staff_notifications' }));
export const StaffAlert = mongoose.model('StaffAlert', new Schema({
  _id: id, restaurantId, partyId: { type: String, required: true }, tableId: String,
  message: { type: String, required: true }, channel: { type: String, default: 'in-app' },
  requestId: { type: String, required: true },
}, { timestamps: true, collection: 'staff_alerts' }).index({ restaurantId: 1, requestId: 1 }, { unique: true }));
