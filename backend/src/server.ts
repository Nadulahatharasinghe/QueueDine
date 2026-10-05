import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import settingsRoutes from './routes/settingsRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'QueueDine API Server' });
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
