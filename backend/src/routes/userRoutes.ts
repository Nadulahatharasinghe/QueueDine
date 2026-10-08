import { Router } from 'express';
import multer from 'multer';
import { getProfile, updateProfile, uploadProfilePicture, deleteProfilePicture, getUserStats } from '../controllers/userController';
import { upload } from '../utils/upload';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/stats', authMiddleware, getUserStats);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/profile/picture', authMiddleware, (req, res, next) => {
  upload.single('picture')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Profile photo exceeds the 5 MB limit.' });
      return;
    }
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  });
}, uploadProfilePicture);
router.delete('/profile/picture', authMiddleware, deleteProfilePicture);

export default router;
