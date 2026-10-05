import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import { staffRoutes, releaseExpiredHolds } from './staff/routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'QueueDine API Server' });
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
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
