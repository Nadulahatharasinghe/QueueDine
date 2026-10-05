import { Request, Response } from 'express';
import Settings from '../models/Settings';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    res.status(200).json({
      welcomeBackgroundImage: settings.welcomeBackgroundImage,
      welcomeBackgroundImageName: settings.welcomeBackgroundImageName,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while fetching settings' });
    }
  }
};

export const uploadWelcomeBackground = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        welcomeBackgroundImage: imageDataUrl,
        welcomeBackgroundImageName: file.originalname,
      });
    } else {
      settings.welcomeBackgroundImage = imageDataUrl;
      settings.welcomeBackgroundImageName = file.originalname;
      await settings.save();
    }

    res.status(200).json({
      welcomeBackgroundImage: settings.welcomeBackgroundImage,
      welcomeBackgroundImageName: settings.welcomeBackgroundImageName,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred while uploading image' });
    }
  }
};
