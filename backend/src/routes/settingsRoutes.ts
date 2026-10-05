import { Router } from 'express';
import { getSettings, uploadWelcomeBackground } from '../controllers/settingsController';
import { upload } from '../utils/upload';

const router = Router();

router.get('/', getSettings);
router.post('/welcome-background', upload.single('image'), uploadWelcomeBackground);

export default router;
