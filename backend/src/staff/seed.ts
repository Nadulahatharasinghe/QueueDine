import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { StaffAccount, StaffRestaurant, StaffTable } from './models';

async function main() {
  const password = process.env.STAFF_SEED_PASSWORD;
  const email = process.env.STAFF_SEED_EMAIL?.toLowerCase();
  if (!password || password.length < 10 || !email || !email.includes('@')) throw new Error('Set STAFF_SEED_EMAIL and STAFF_SEED_PASSWORD (at least 10 characters) before running setup.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env.');
  await mongoose.connect(process.env.MONGODB_URI);
  const restaurantId = 'ember-oak';
  await StaffRestaurant.updateOne({ _id: restaurantId }, { $setOnInsert: { name: 'Ember & Oak', location: 'Colombo', timeZone: 'Asia/Colombo' } }, { upsert: true });
  const old = await StaffAccount.findOne({ email });
  if (!old) await StaffAccount.create({ restaurantId, email, staffId: process.env.STAFF_SEED_ID || 'host-001', fullName: process.env.STAFF_SEED_NAME || 'Tharindu Silva', passwordHash: await bcrypt.hash(password, 12), shiftStart: '16:00', shiftEnd: '23:00' });
  for (let n = 1; n <= 12; n++) {
    const number = `T${String(n).padStart(2, '0')}`;
    await StaffTable.updateOne({ restaurantId, number }, { $setOnInsert: { capacity: n % 3 === 0 ? 6 : 4, area: n > 9 ? 'Outdoor' : 'Main Area', status: 'available' } }, { upsert: true });
  }
  console.log('Staff setup complete. Existing customer data and existing staff passwords were not changed.');
}
main().catch(error => { console.error(error instanceof Error ? error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[hidden]') : 'Setup failed'); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
