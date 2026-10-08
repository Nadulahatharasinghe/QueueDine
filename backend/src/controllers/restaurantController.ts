import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant';
import Table from '../models/Table';
import Reservation from '../models/Reservation';
import QueueEntry from '../models/QueueEntry';
import mongoose from 'mongoose';
import { findFileById, openDownloadStream } from '../utils/gridfs';

const AVERAGE_WAIT_PER_PARTY_MIN = 2;

const photoUrlFor = (r: { _id: mongoose.Types.ObjectId | string; photoFileId?: unknown }) => {
  return r.photoFileId ? `/api/restaurants/${r._id}/photo` : null;
};

export const listRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurants = await Restaurant.find();

    const enriched = await Promise.all(
      restaurants.map(async (r) => {
        const restaurantId = r._id as mongoose.Types.ObjectId;
        const [queueLength, availableTables] = await Promise.all([
          QueueEntry.countDocuments({ restaurantId, status: 'waiting' }),
          Table.countDocuments({ restaurantId, status: 'available' }),
        ]);
        const estimatedWait = queueLength * AVERAGE_WAIT_PER_PARTY_MIN;
        const imageUrl = photoUrlFor(r);
        return {
          _id: r._id,
          name: r.name,
          location: r.location,
          rating: r.rating,
          reviewCount: r.reviewCount,
          imageUrl,
          description: r.description,
          openingHours: r.openingHours,
          cuisine: r.cuisine,
          currentWaitTime: estimatedWait,
          queueLength,
          availableTables,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
  }
};

export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const restaurantId = restaurant._id as mongoose.Types.ObjectId;
    const [queueLength, availableTables] = await Promise.all([
      QueueEntry.countDocuments({ restaurantId, status: 'waiting' }),
      Table.countDocuments({ restaurantId, status: 'available' }),
    ]);

    const estimatedWait = queueLength * AVERAGE_WAIT_PER_PARTY_MIN;
    const imageUrl = photoUrlFor(restaurant);

    res.status(200).json({
      _id: restaurant._id,
      name: restaurant.name,
      location: restaurant.location,
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      imageUrl,
      description: restaurant.description,
      openingHours: restaurant.openingHours,
      cuisine: restaurant.cuisine,
      currentWaitTime: estimatedWait,
      queueLength,
      availableTables,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
  }
};

export const getRestaurantPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    if (!restaurant.photoFileId) {
      res.status(404).json({ error: 'Restaurant photo not found' });
      return;
    }
    const file = await findFileById(restaurant.photoFileId);
    if (!file) {
      res.status(404).json({ error: 'Restaurant photo not found' });
      return;
    }
    const metadataContentType = (file.metadata as any)?.contentType;
    const directContentType = (file as any).contentType;
    let contentType: string;
    if (metadataContentType) contentType = metadataContentType;
    else if (directContentType) contentType = directContentType;
    else if (/\.png$/i.test(file.filename)) contentType = 'image/png';
    else if (/\.webp$/i.test(file.filename)) contentType = 'image/webp';
    else contentType = 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const stream = openDownloadStream(restaurant.photoFileId);
    let sent = false;
    stream.on('error', (_err: unknown) => {
      if (sent) return;
      sent = true;
      if (!res.headersSent) res.status(404).json({ error: 'Restaurant photo not found' });
      else res.end();
    });
    stream.on('end', () => { sent = true; });
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) return;
    res.status(500).json({ error: 'Failed to fetch restaurant photo' });
  }
};

export const getRestaurantTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const tables = await Table.find({ restaurantId: id }).sort({ tableNumber: 1 });
    res.status(200).json(tables);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch tables' });
    }
  }
};

export const getRestaurantQueueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const restaurantId = restaurant._id as mongoose.Types.ObjectId;
    const queueLength = await QueueEntry.countDocuments({ restaurantId, status: 'waiting' });
    const estimatedWait = queueLength * AVERAGE_WAIT_PER_PARTY_MIN;

    res.status(200).json({
      queueLength,
      estimatedWaitTime: estimatedWait,
      partiesAhead: Math.max(queueLength - 1, 0),
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch queue stats' });
    }
  }
};
