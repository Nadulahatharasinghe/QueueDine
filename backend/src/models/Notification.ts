import mongoose, { Document, Schema } from 'mongoose';

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

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: mongoose.Types.ObjectId | null;
  relatedType?: RelatedType | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: [
        'reservation_created',
        'reservation_modified',
        'reservation_cancelled',
        'queue_joined',
        'queue_position_changed',
        'queue_next',
        'queue_cancelled',
        'queue_status_changed',
        'system',
      ],
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    relatedType: {
      type: String,
      enum: ['reservation', 'queue', 'restaurant', 'system'],
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
