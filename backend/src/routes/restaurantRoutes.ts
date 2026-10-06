import { Router } from 'express';
import {
  listRestaurants,
  getRestaurantById,
  getRestaurantTables,
  getRestaurantQueueStats,
} from '../controllers/restaurantController';

const router = Router();

router.get('/', listRestaurants);
router.get('/:id', getRestaurantById);
router.get('/:id/tables', getRestaurantTables);
router.get('/:id/queue-stats', getRestaurantQueueStats);

export default router;
