import mongoose, { Document, Schema } from 'mongoose';

export type QueueStatus = 'waiting' | 'called' | 'seated' | 'cancelled';

export interface IQueueEntry extends Document {
  userId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  queueNumber: number;
  guests: number;
  position: number;
  estimatedWaitTime: number;
  status: QueueStatus;
  specialRequests?: string | null;
  joinedAt: Date;
  calledAt?: Date | null;
  seatedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const QueueEntrySchema: Schema = new Schema(
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
    queueNumber: {
      type: Number,
      required: [true, 'Queue number is required'],
      min: 1,
    },
    guests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: 1,
      max: 20,
    },
    position: {
      type: Number,
      required: [true, 'Position is required'],
      min: 1,
    },
    estimatedWaitTime: {
      type: Number,
      required: [true, 'Estimated wait time is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['waiting', 'called', 'seated', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    specialRequests: {
      type: String,
      trim: true,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    calledAt: {
      type: Date,
      default: null,
    },
    seatedAt: {
      type: Date,
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

QueueEntrySchema.index(
  { userId: 1, restaurantId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'waiting' },
  }
);

QueueEntrySchema.index({ restaurantId: 1, status: 1, joinedAt: 1 });
QueueEntrySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IQueueEntry>('QueueEntry', QueueEntrySchema);
