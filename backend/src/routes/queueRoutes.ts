import { Router } from 'express';
import {
  joinQueue,
  getActiveQueue,
  getQueueHistory,
  getQueueStatus,
  cancelQueue,
} from '../controllers/queueController';

const router = Router();

router.post('/join', joinQueue);
router.get('/active/:restaurantId', getActiveQueue);
router.get('/', getQueueHistory);
router.get('/:id/status', getQueueStatus);
router.put('/:id/cancel', cancelQueue);

export default router;
