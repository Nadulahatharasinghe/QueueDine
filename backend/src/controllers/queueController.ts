import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import QueueEntry, { IQueueEntry } from '../models/QueueEntry';
import Restaurant from '../models/Restaurant';
import mongoose from 'mongoose';
import {
  createNotification,
  createNotificationsBulk,
  CreateNotificationInput,
} from './notificationController';
import { emitStaffNotification, syntheticQueueId } from '../utils/staffSync';

const AVERAGE_WAIT_PER_PARTY_MIN = 2;

const getOwner = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId as string;
};

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const recalculatePositions = async (
  restaurantId: mongoose.Types.ObjectId | string
): Promise<{
  previousPositions: Record<string, { userId: string; position: number }>;
  newPositions: Record<string, { userId: string; position: number }>;
}> => {
  const waiting = await QueueEntry.find({
    restaurantId,
    status: 'waiting',
  })
    .sort({ joinedAt: 1, _id: 1 })
    .exec();

  const previousPositions: Record<string, { userId: string; position: number }> = {};
  waiting.forEach((e) => {
    previousPositions[String(e._id)] = {
      userId: String(e.userId),
      position: e.position,
    };
  });

  const bulk = waiting.map((entry, idx) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: {
        position: idx + 1,
        estimatedWaitTime: (idx + 1) * AVERAGE_WAIT_PER_PARTY_MIN,
      },
    },
  }));

  if (bulk.length > 0) {
    await QueueEntry.bulkWrite(bulk);
  }

  const refreshed = await QueueEntry.find({
    restaurantId,
    status: 'waiting',
  })
    .sort({ joinedAt: 1, _id: 1 })
    .exec();

  const newPositions: Record<string, { userId: string; position: number }> = {};
  refreshed.forEach((e, idx) => {
    newPositions[String(e._id)] = {
      userId: String(e.userId),
      position: idx + 1,
    };
  });

  return { previousPositions, newPositions };
};

export const joinQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { restaurantId, guests, specialRequests } = req.body as {
      restaurantId?: string;
      guests?: number;
      specialRequests?: string;
    };

    if (!restaurantId || typeof guests !== 'number') {
      res.status(400).json({ error: 'restaurantId and guests are required' });
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

    const rid = restaurant._id as mongoose.Types.ObjectId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayCount = await QueueEntry.countDocuments({
      restaurantId: rid,
      joinedAt: { $gte: todayStart, $lt: tomorrowStart },
    });

    const queueNumber = todayCount + 1;

    const aheadCount = await QueueEntry.countDocuments({
      restaurantId: rid,
      status: 'waiting',
    });
    const position = aheadCount + 1;
    const estimatedWaitTime = position * AVERAGE_WAIT_PER_PARTY_MIN;

    let entry: IQueueEntry | null = null;
    try {
      const createPayload: any = {
        userId,
        restaurantId: rid,
        queueNumber,
        guests,
        position,
        estimatedWaitTime,
        status: 'waiting',
        joinedAt: new Date(),
      };
      if (specialRequests !== undefined && specialRequests !== null) {
        createPayload.specialRequests = specialRequests;
      }
      entry = (await QueueEntry.create(createPayload)) as IQueueEntry;
    } catch (e: any) {
      if (e?.code === 11000) {
        res.status(409).json({ error: 'Already in active queue for this restaurant' });
        return;
      }
      throw e;
    }

    const { newPositions } = await recalculatePositions(rid);
    void notifyPositionChanges(newPositions, newPositions); // No-op since we want to notify join first

    const refreshed = entry
      ? await QueueEntry.findById((entry as IQueueEntry)._id).populate(
          'restaurantId',
          'name location imageUrl photoFileId'
        )
      : null;

    const restName = restaurant?.name || 'Restaurant';
    void createNotification({
      userId,
      type: 'queue_joined',
      title: 'Joined Queue',
      message: `You have joined the queue at ${restName}. Your number is Q-${String(queueNumber).padStart(3, '0')}.`,
      relatedId: (entry as IQueueEntry)._id,
      relatedType: 'queue',
    });
    void emitStaffNotification(String(rid), {
      category: 'Queue',
      message: `Customer joined queue Q-${String(queueNumber).padStart(3, '0')} for ${guests} guests`,
      partyId: syntheticQueueId((entry as IQueueEntry)._id),
    });

    // Notify user that became next (position=1) if any
    if (refreshed) {
      const firstInLine = await QueueEntry.findOne({
        restaurantId: rid,
        status: 'waiting',
        position: 1,
      });
      if (firstInLine && String(firstInLine._id) !== String((entry as IQueueEntry)._id)) {
        // User was first before, still first - no need to notify them of join.
      }
    }

    res.status(201).json(refreshed);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to join queue' });
    }
  }
};

const notifyPositionChanges = async (
  previousPositions: Record<string, { userId: string; position: number }>,
  newPositions: Record<string, { userId: string; position: number }>
) => {
  const notifications: CreateNotificationInput[] = [];
  for (const entryId of Object.keys(newPositions)) {
    const prev = previousPositions[entryId];
    const now = newPositions[entryId];
    if (!prev || !now) continue;
    if (prev.position !== now.position && now.position < prev.position) {
      // Position improved
      const title =
        now.position === 1
          ? 'You are next in queue!'
          : 'Queue Position Updated';
      const message =
        now.position === 1
          ? `You are now at position 1. You will be called soon!`
          : `Your queue position has improved from ${prev.position} to ${now.position}.`;
      notifications.push({
        userId: now.userId,
        type: now.position === 1 ? 'queue_next' : 'queue_position_changed',
        title,
        message,
        relatedId: new mongoose.Types.ObjectId(entryId),
        relatedType: 'queue',
      });
    }
  }
  if (notifications.length > 0) {
    await createNotificationsBulk(notifications);
  }
};

export const getActiveQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { restaurantId } = req.params;
    const entry = await QueueEntry.findOne({
      userId,
      restaurantId,
      status: { $in: ['waiting', 'called'] },
    }).populate('restaurantId', 'name location imageUrl photoFileId');

    if (!entry) {
      res.status(200).json({ entry: null });
      return;
    }

    const partiesAhead = Math.max(0, entry.position - 1);

    res.status(200).json({
      entry,
      partiesAhead,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch active queue' });
    }
  }
};

export const getQueueHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const entries = await QueueEntry.find({ userId })
      .populate('restaurantId', 'name location imageUrl photoFileId')
      .sort({ createdAt: -1 });

    res.status(200).json(entries);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch queue history' });
    }
  }
};

export const getQueueStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { id } = req.params;
    const entry = await QueueEntry.findById(id).populate('restaurantId', 'name location imageUrl photoFileId');
    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found' });
      return;
    }
    if (String(entry.userId) !== String(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const restaurantId = (entry.restaurantId as unknown as { _id: mongoose.Types.ObjectId })._id;
    const { newPositions, previousPositions } = await recalculatePositions(restaurantId);
    void notifyPositionChanges(previousPositions, newPositions);

    const refreshed = await QueueEntry.findById(id).populate('restaurantId', 'name location imageUrl photoFileId');
    const partiesAhead = refreshed ? Math.max(0, refreshed.position - 1) : 0;
    const calledNumber = refreshed
      ? await QueueEntry.findOne({
          restaurantId,
          status: { $in: ['called', 'seated'] as any },
        } as any)
          .sort({ calledAt: -1, seatedAt: -1 })
          .select('queueNumber')
      : null;

    res.status(200).json({
      entry: refreshed,
      partiesAhead,
      currentCalledQueueNumber: calledNumber?.queueNumber ?? null,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch queue status' });
    }
  }
};

export const cancelQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = await getOwner(req, res);
    if (!userId) return;

    const { id } = req.params;
    const entry = await QueueEntry.findById(id).populate('restaurantId', 'name location imageUrl photoFileId');
    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found' });
      return;
    }
    if (String(entry.userId) !== String(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (entry.status !== 'waiting') {
      res.status(400).json({ error: 'Only waiting entries can be cancelled' });
      return;
    }

    const rid = (entry.restaurantId as unknown as { _id: mongoose.Types.ObjectId })._id;

    entry.status = 'cancelled';
    entry.cancelledAt = new Date();
    await entry.save();

    const { previousPositions, newPositions } = await recalculatePositions(rid);
    void notifyPositionChanges(previousPositions, newPositions);

    const refreshed = await QueueEntry.findById(id).populate('restaurantId', 'name location imageUrl photoFileId');

    const restName =
      typeof entry.restaurantId === 'object'
        ? (entry.restaurantId as any).name
        : 'Restaurant';
    void createNotification({
      userId,
      type: 'queue_cancelled',
      title: 'Left Queue',
      message: `You have left the queue at ${restName}. Your queue number was Q-${String(entry.queueNumber).padStart(3, '0')}.`,
      relatedId: entry._id,
      relatedType: 'queue',
    });
    void emitStaffNotification(String(rid), {
      category: 'Queue',
      message: `Customer left queue Q-${String(entry.queueNumber).padStart(3, '0')} (was for ${entry.guests} guests)`,
      partyId: syntheticQueueId(entry._id),
    });

    res.status(200).json(refreshed);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to cancel queue' });
    }
  }
};
