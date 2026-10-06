import { Request, Response } from 'express';
import User from '../models/User';
import Reservation from '../models/Reservation';
import QueueEntry from '../models/QueueEntry';
import Favorite from '../models/Favorite';
import { AuthRequest } from '../middleware/authMiddleware';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      seatingPreference: user.seatingPreference,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while fetching profile' });
    }
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { fullName, phone, seatingPreference } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (fullName) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (seatingPreference) user.seatingPreference = seatingPreference;

    await user.save();

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      seatingPreference: user.seatingPreference,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while updating profile' });
    }
  }
};

export const uploadProfilePicture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const file = req.file as Express.Multer.File;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.profilePicture = imageDataUrl;
    await user.save();

    res.status(200).json({
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while uploading profile picture' });
    }
  }
};

export const deleteProfilePicture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.profilePicture = null;
    await user.save();

    res.status(200).json({
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while deleting profile picture' });
    }
  }
};

export const getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const bookingsCount = await Reservation.countDocuments({ userId });
    const activeQueuesCount = await QueueEntry.countDocuments({ userId, status: 'waiting' });
    const favoritesCount = await Favorite.countDocuments({ userId });

    res.status(200).json({
      bookings: bookingsCount,
      queues: activeQueuesCount,
      favorites: favoritesCount,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while fetching user stats' });
    }
  }
};
