import bcrypt from 'bcryptjs';
import { StaffAccount } from './models';

const seededHost = {
  email: 'host@queuedine.local',
  staffId: 'host-001',
  restaurantId: 'ember-oak',
} as const;

interface SeedStaffAccountOptions {
  email: string;
  staffId: string;
  fullName: string;
  restaurantId: string;
  password: string;
  resetPassword: boolean;
}

export async function seedStaffAccount(options: SeedStaffAccountOptions) {
  const { email, staffId, fullName, restaurantId, password, resetPassword } = options;
  if (resetPassword) {
    if (!['development', 'test'].includes(process.env.NODE_ENV || '')) {
      throw new Error('Seeded host password reset is available only in local development.');
    }
    if (
      email !== seededHost.email ||
      staffId !== seededHost.staffId ||
      restaurantId !== seededHost.restaurantId
    ) {
      throw new Error('Password reset is restricted to the seeded host account.');
    }
  }

  const old = await StaffAccount.findOne({ email });
  if (!old) {
    return StaffAccount.create({
      restaurantId,
      email,
      staffId,
      fullName,
      passwordHash: await bcrypt.hash(password, 12),
      shiftStart: '16:00',
      shiftEnd: '23:00',
    });
  }
  if (!resetPassword) return old;

  const result = await StaffAccount.updateOne(
    { _id: old._id, ...seededHost },
    { $set: { passwordHash: await bcrypt.hash(password, 12) } },
  );
  if (result.matchedCount !== 1) {
    throw new Error('The seeded host account did not match the expected identity.');
  }
  return StaffAccount.findById(old._id);
}
