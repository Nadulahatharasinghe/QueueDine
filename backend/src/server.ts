import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import { staffRoutes, releaseExpiredHolds } from './staff/routes';
import { managerRoutes } from './manager/routes';
import settingsRoutes from './routes/settingsRoutes';
import userRoutes from './routes/userRoutes';
import restaurantRoutes from './routes/restaurantRoutes';
import reservationRoutes from './routes/reservationRoutes';
import queueRoutes from './routes/queueRoutes';
import notificationRoutes from './routes/notificationRoutes';
import favoriteRoutes from './routes/favoriteRoutes';
import { authMiddleware } from './middleware/authMiddleware';
import { seedRestaurantData } from './utils/seed';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/reservations', authMiddleware, reservationRoutes);
app.use('/api/queue', authMiddleware, queueRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/favorites', authMiddleware, favoriteRoutes);

console.log('User routes mounted at /api/users');

app.get('/', (req, res) => {
  res.json({ message: 'QueueDine API Server' });
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await seedRestaurantData();

    // A persisted expiry survives restarts; the worker releases reservation holds.
    let releasingHolds = false;
    const releaseHolds = async () => {
      if (releasingHolds) return;
      releasingHolds = true;
      try { await releaseExpiredHolds(); }
      catch { console.error('Unable to release expired staff holds; retrying shortly.'); }
      finally { releasingHolds = false; }
    };
    void releaseHolds();
    setInterval(() => { void releaseHolds(); }, 15000).unref();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
