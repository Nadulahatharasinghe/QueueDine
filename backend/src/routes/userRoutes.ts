import { Router } from 'express';
import { getProfile, updateProfile, uploadProfilePicture, deleteProfilePicture, getUserStats } from '../controllers/userController';
import { upload } from '../utils/upload';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/stats', authMiddleware, getUserStats);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/profile/picture', authMiddleware, upload.single('picture'), uploadProfilePicture);
router.delete('/profile/picture', authMiddleware, deleteProfilePicture);

export default router;
