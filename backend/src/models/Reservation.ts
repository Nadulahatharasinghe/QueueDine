import mongoose, { Document, Schema } from 'mongoose';

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface IReservation extends Document {
  userId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  specialRequests?: string | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      required: [true, 'Table ID is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      index: true,
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
      index: true,
    },
    guests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: 1,
      max: 20,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
      index: true,
    },
    specialRequests: {
      type: String,
      trim: true,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ReservationSchema.index(
  { tableId: 1, date: 1, time: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'confirmed' },
  }
);

ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ restaurantId: 1, date: 1 });

export default mongoose.model<IReservation>('Reservation', ReservationSchema);
