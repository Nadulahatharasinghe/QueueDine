import 'dotenv/config';
import mongoose from 'mongoose';
import { StaffRestaurant, StaffTable } from './models';
import { seedStaffAccount } from './seedAccount';
import Restaurant from '../models/Restaurant';

async function main() {
  const password = process.env.STAFF_SEED_PASSWORD;
  const email = process.env.STAFF_SEED_EMAIL?.toLowerCase();
  if (!password || password.length < 10 || !email || !email.includes('@')) throw new Error('Set STAFF_SEED_EMAIL and STAFF_SEED_PASSWORD (at least 10 characters) before running setup.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env.');
  if (
    process.env.STAFF_SEED_RESET_PASSWORD === 'true' &&
    !['development', 'test'].includes(process.env.NODE_ENV || '')
  ) {
    throw new Error('STAFF_SEED_RESET_PASSWORD is available only in local development.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const restaurantId = 'ember-oak';
  const customerRestaurant = await Restaurant.findOne({ name: 'Ember & Oak' });
  const staffRestSet: Record<string, unknown> = { name: 'Ember & Oak', location: 'Colombo', timeZone: 'Asia/Colombo' };
  if (customerRestaurant) staffRestSet.customerRestaurantId = customerRestaurant._id;
  await StaffRestaurant.updateOne({ _id: restaurantId }, { $setOnInsert: staffRestSet, $set: customerRestaurant ? { customerRestaurantId: customerRestaurant._id } : {} }, { upsert: true });
  await seedStaffAccount({
    restaurantId,
    email,
    staffId: process.env.STAFF_SEED_ID || 'host-001',
    fullName: process.env.STAFF_SEED_NAME || 'Tharindu Silva',
    password,
    resetPassword: process.env.STAFF_SEED_RESET_PASSWORD === 'true',
  });
  for (let n = 1; n <= 12; n++) {
    const number = `T${String(n).padStart(2, '0')}`;
    await StaffTable.updateOne({ restaurantId, number }, { $setOnInsert: { capacity: n % 3 === 0 ? 6 : 4, area: n > 9 ? 'Outdoor' : 'Main Area', status: 'available' } }, { upsert: true });
  }
  console.log('Staff setup complete. Existing customer data and existing staff passwords were not changed.');
}
main().catch(error => { console.error(error instanceof Error ? error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[hidden]') : 'Setup failed'); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
