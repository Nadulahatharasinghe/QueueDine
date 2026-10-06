import { Router } from 'express';
import { getFavorites, addFavorite, removeFavorite, getFavoriteCount } from '../controllers/favoriteController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authMiddleware, getFavorites);
router.post('/', authMiddleware, addFavorite);
router.delete('/:restaurantId', authMiddleware, removeFavorite);
router.get('/count', authMiddleware, getFavoriteCount);

export default router;
