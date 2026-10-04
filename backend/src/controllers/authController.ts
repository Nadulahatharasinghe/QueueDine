import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/authService';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, phone, seatingPreference } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ error: 'Full name, email, and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const { user, token } = await registerUser(fullName, email, password, phone, seatingPreference);

    res.status(201).json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        seatingPreference: user.seatingPreference,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Email already exists') {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred during registration' });
    }
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const { user, token } = await loginUser(email, password);

    res.status(200).json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        seatingPreference: user.seatingPreference,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        res.status(401).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An error occurred during login' });
    }
  }
};
