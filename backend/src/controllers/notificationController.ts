import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Notification, {
  INotification,
  NotificationType,
  RelatedType,
} from '../models/Notification';
import mongoose from 'mongoose';

const getOwner = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId as string;
};

export const listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.status(200).json({ unreadCount });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { id } = req.params;
    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json(notification);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({
      markedCount: result.modifiedCount,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  }
};

export interface CreateNotificationInput {
  userId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string | mongoose.Types.ObjectId | null;
  relatedType?: RelatedType | null;
}

export const createNotification = async (
  input: CreateNotificationInput
): Promise<INotification | null> => {
  try {
    if (!input.userId) return null;
    const created = await Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedId: input.relatedId ?? null,
      relatedType: input.relatedType ?? null,
      isRead: false,
      readAt: null,
    });
    return created as INotification;
  } catch (error) {
    console.error('createNotification error:', error);
    return null;
  }
};

export const createNotificationsBulk = async (
  inputs: CreateNotificationInput[]
): Promise<void> => {
  if (inputs.length === 0) return;
  try {
    const docs = inputs
      .filter((i) => !!i.userId)
      .map((i) => ({
        userId: i.userId,
        type: i.type,
        title: i.title,
        message: i.message,
        relatedId: i.relatedId ?? null,
        relatedType: i.relatedType ?? null,
        isRead: false,
        readAt: null,
      }));
    if (docs.length > 0) {
      await Notification.insertMany(docs, { ordered: false });
    }
  } catch (error) {
    console.error('createNotificationsBulk error:', error);
  }
};
