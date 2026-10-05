import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import Settings from '../models/Settings';

dotenv.config();

const uploadWelcomeImage = async () => {
  try {
    await connectDatabase();

    const imagePath = path.join(__dirname, '../../../mobile/photos/welcome_page_background_image.png');

    if (!fs.existsSync(imagePath)) {
      console.error('Image file not found:', imagePath);
      process.exit(1);
    }

    console.log('Found image at:', imagePath);

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;

    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        welcomeBackgroundImage: imageDataUrl,
        welcomeBackgroundImageName: 'welcome_page_background_image.png',
      });
    } else {
      settings.welcomeBackgroundImage = imageDataUrl;
      settings.welcomeBackgroundImageName = 'welcome_page_background_image.png';
      await settings.save();
    }

    console.log('Welcome background image uploaded successfully to MongoDB!');
    console.log('Image name:', settings.welcomeBackgroundImageName);
    console.log('Image data URL length:', settings.welcomeBackgroundImage?.length);

    process.exit(0);
  } catch (error) {
    console.error('Error uploading image:', error);
    process.exit(1);
  }
};

uploadWelcomeImage();
