import { Request, Response } from 'express';
import Favorite from '../models/Favorite';
import { AuthRequest } from '../middleware/authMiddleware';

export const getFavorites = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const favorites = await Favorite.find({ userId })
      .populate('restaurantId')
      .sort({ createdAt: -1 });

    res.status(200).json(favorites);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while fetching favorites' });
    }
  }
};

export const addFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { restaurantId } = req.body;

    if (!restaurantId) {
      res.status(400).json({ error: 'Restaurant ID is required' });
      return;
    }

    const existingFavorite = await Favorite.findOne({ userId, restaurantId });

    if (existingFavorite) {
      res.status(400).json({ error: 'Restaurant already in favorites' });
      return;
    }

    const favorite = new Favorite({ userId, restaurantId });
    await favorite.save();

    res.status(201).json(favorite);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while adding favorite' });
    }
  }
};

export const removeFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { restaurantId } = req.params;

    const favorite = await Favorite.findOneAndDelete({ userId, restaurantId });

    if (!favorite) {
      res.status(404).json({ error: 'Favorite not found' });
      return;
    }

    res.status(200).json({ message: 'Favorite removed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while removing favorite' });
    }
  }
};

export const getFavoriteCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const count = await Favorite.countDocuments({ userId });

    res.status(200).json({ count });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while fetching favorite count' });
    }
  }
};
