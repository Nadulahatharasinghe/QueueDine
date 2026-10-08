import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';

const id = { type: String, default: randomUUID };
const restaurantId = { type: String, required: true, index: true };

const customerFlowItemSchema = new Schema({
  hour: { type: String, required: true },
  reservations: { type: Number, default: 0 },
  walkIns: { type: Number, default: 0 },
  seated: { type: Number, default: 0 },
}, { _id: false });

const staffReportSchema = new Schema({
  _id: id,
  restaurantId,
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  dateLabel: { type: String, required: true }, // Format: Thu, 24 Apr 2025
  totalReservations: { type: Number, default: 0 },
  walkIns: { type: Number, default: 0 },
  customersSeated: { type: Number, default: 0 },
  avgWaitTime: { type: Number, default: 0 }, // in minutes
  noShowsCount: { type: Number, default: 0 },
  noShowsPercent: { type: Number, default: 0 },
  walkawaysCount: { type: Number, default: 0 },
  walkawaysPercent: { type: Number, default: 0 },
  peakHour: { type: String, default: '7:00 PM - 8:00 PM' },
  highestWaitTime: { type: Number, default: 0 },
  overallOccupancy: { type: Number, default: 0 }, // percentage 0-100
  customerFlow: { type: [customerFlowItemSchema], default: [] },
  notes: { type: String, default: '' },
  createdBy: { type: String, required: true },
}, { timestamps: true, collection: 'staff_reports' });

staffReportSchema.index({ restaurantId: 1, date: 1 }, { unique: true });

export const StaffReport = mongoose.model('StaffReport', staffReportSchema);
