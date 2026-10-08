import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { StaffAccount, StaffRestaurant, StaffTable, StaffParty, StaffNotification } from './models';
import { StaffReport } from '../manager/models';
import { formatDateLabel } from '../manager/analytics';
import { seedStaffAccount } from './seedAccount';
import Restaurant from '../models/Restaurant';

function getIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
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
  await StaffRestaurant.updateOne(
    { _id: restaurantId },
    { $setOnInsert: staffRestSet, $set: customerRestaurant ? { customerRestaurantId: customerRestaurant._id } : {} },
    { upsert: true }
  );

  // 1. Seed Host Account (Tharindu Silva)
  const hostEmail = (process.env.STAFF_SEED_EMAIL || 'host@queuedine.local').toLowerCase();
  const hostPass = process.env.STAFF_SEED_PASSWORD || 'Host@12345';
  await seedStaffAccount({
    restaurantId,
    email: hostEmail,
    staffId: process.env.STAFF_SEED_ID || 'host-001',
    fullName: process.env.STAFF_SEED_NAME || 'Tharindu Silva',
    password: hostPass,
    resetPassword: process.env.STAFF_SEED_RESET_PASSWORD === 'true',
  });

  // 2. Seed Manager Account (R. Perera)
  const managerId = process.env.MANAGER_SEED_ID || 'manager-001';
  const managerEmail = (process.env.MANAGER_SEED_EMAIL || 'manager@example.com').toLowerCase();
  const managerPass = process.env.MANAGER_SEED_PASSWORD || 'ManagerPass123!';
  const existingManager = await StaffAccount.findOne({ $or: [{ email: managerEmail }, { staffId: managerId }] });
  if (!existingManager) {
    await StaffAccount.create({
      restaurantId,
      email: managerEmail,
      staffId: managerId,
      fullName: process.env.MANAGER_SEED_NAME || 'R. Perera',
      passwordHash: await bcrypt.hash(managerPass, 12),
      role: 'manager',
      shiftStart: '09:00',
      shiftEnd: '22:00',
    });
    console.log(`Seeded manager account: ${managerEmail} (ID: ${managerId})`);
  } else {
    existingManager.passwordHash = await bcrypt.hash(managerPass, 12);
    existingManager.role = 'manager';
    existingManager.isActive = true;
    await existingManager.save();
    console.log(`Updated manager account: ${existingManager.email} (ID: ${existingManager.staffId})`);
  }

  // 3. Seed Tables (T01 - T12)
  for (let n = 1; n <= 12; n++) {
    const number = `T${String(n).padStart(2, '0')}`;
    await StaffTable.updateOne(
      { restaurantId, number },
      { $setOnInsert: { capacity: n % 3 === 0 ? 6 : 4, area: n > 9 ? 'Outdoor' : 'Main Area', status: n === 2 ? 'occupied' : n === 5 ? 'occupied' : n === 8 ? 'reserved' : 'available' } },
      { upsert: true }
    );
  }

  // 4. Seed Dynamic Historical Reports for the past 30 days
  const now = new Date();
  for (let offset = 0; offset <= 30; offset++) {
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12, 0, 0);
    const dateStr = getIsoDate(target);
    const dayOfWeek = target.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const occ = isWeekend ? 88 + (offset % 5) : 68 + (offset % 9);
    const reservations = isWeekend ? 52 + (offset % 10) : 38 + (offset % 7);
    const walkIns = isWeekend ? 84 + (offset % 14) : 62 + (offset % 9);
    const seated = Math.round((reservations + walkIns) * 0.92);
    const avgWait = isWeekend ? 28 + (offset % 6) : 20 + (offset % 5);
    const noShows = Math.max(1, Math.round(reservations * 0.06));
    const walkaways = Math.max(2, Math.round(walkIns * 0.08));

    await StaffReport.updateOne(
      { restaurantId, date: dateStr },
      {
        $set: {
          restaurantId,
          date: dateStr,
          dateLabel: formatDateLabel(dateStr),
          totalReservations: reservations,
          walkIns,
          customersSeated: seated,
          avgWaitTime: avgWait,
          noShowsCount: noShows,
          noShowsPercent: Math.round((noShows / reservations) * 100),
          walkawaysCount: walkaways,
          walkawaysPercent: Math.round((walkaways / walkIns) * 100),
          peakHour: '7:00 PM - 8:00 PM',
          highestWaitTime: avgWait + 12,
          overallOccupancy: occ,
          customerFlow: [
            { hour: '12 PM', reservations: Math.round(reservations * 0.15), walkIns: Math.round(walkIns * 0.18), seated: Math.round(seated * 0.15) },
            { hour: '2 PM', reservations: Math.round(reservations * 0.18), walkIns: Math.round(walkIns * 0.16), seated: Math.round(seated * 0.17) },
            { hour: '4 PM', reservations: Math.round(reservations * 0.14), walkIns: Math.round(walkIns * 0.12), seated: Math.round(seated * 0.13) },
            { hour: '6 PM', reservations: Math.round(reservations * 0.22), walkIns: Math.round(walkIns * 0.24), seated: Math.round(seated * 0.23) },
            { hour: '8 PM', reservations: Math.round(reservations * 0.26), walkIns: Math.round(walkIns * 0.25), seated: Math.round(seated * 0.26) },
            { hour: '10 PM', reservations: Math.round(reservations * 0.05), walkIns: Math.round(walkIns * 0.05), seated: Math.round(seated * 0.06) },
          ],
          createdBy: 'manager-001',
        },
      },
      { upsert: true }
    );
  }

  // 5. Seed Figma mock dates (April 2025)
  const aprilMockReports = [
    { date: '2025-04-24', totalReservations: 48, walkIns: 76, customersSeated: 118, avgWaitTime: 26, noShowsCount: 4, noShowsPercent: 5, walkawaysCount: 7, walkawaysPercent: 8, overallOccupancy: 78 },
    { date: '2025-04-23', totalReservations: 42, walkIns: 68, customersSeated: 104, avgWaitTime: 22, noShowsCount: 3, noShowsPercent: 4, walkawaysCount: 5, walkawaysPercent: 6, overallOccupancy: 72 },
    { date: '2025-04-22', totalReservations: 38, walkIns: 60, customersSeated: 92, avgWaitTime: 20, noShowsCount: 2, noShowsPercent: 3, walkawaysCount: 4, walkawaysPercent: 5, overallOccupancy: 69 },
    { date: '2025-04-21', totalReservations: 45, walkIns: 72, customersSeated: 110, avgWaitTime: 24, noShowsCount: 4, noShowsPercent: 5, walkawaysCount: 6, walkawaysPercent: 7, overallOccupancy: 75 },
    { date: '2025-04-20', totalReservations: 55, walkIns: 84, customersSeated: 132, avgWaitTime: 28, noShowsCount: 5, noShowsPercent: 6, walkawaysCount: 8, walkawaysPercent: 9, overallOccupancy: 88 },
    { date: '2025-04-19', totalReservations: 62, walkIns: 95, customersSeated: 148, avgWaitTime: 30, noShowsCount: 6, noShowsPercent: 7, walkawaysCount: 9, walkawaysPercent: 10, overallOccupancy: 91 },
  ];
  for (const r of aprilMockReports) {
    await StaffReport.updateOne(
      { restaurantId, date: r.date },
      {
        $set: {
          ...r,
          restaurantId,
          dateLabel: formatDateLabel(r.date),
          peakHour: '7:00 PM - 8:00 PM',
          highestWaitTime: 38,
          customerFlow: [
            { hour: '12 PM', reservations: 12, walkIns: 18, seated: 8 },
            { hour: '2 PM', reservations: 22, walkIns: 17, seated: 20 },
            { hour: '4 PM', reservations: 42, walkIns: 32, seated: 15 },
            { hour: '6 PM', reservations: 38, walkIns: 27, seated: 24 },
            { hour: '8 PM', reservations: 48, walkIns: 41, seated: 35 },
            { hour: '10 PM', reservations: 41, walkIns: 28, seated: 36 },
          ],
          createdBy: 'manager-001',
        },
      },
      { upsert: true }
    );
  }

  // 6. Seed Dynamic Parties for each of the last 14 days (varying numbers per day)
  const hourOffsets = [12, 14, 16, 18, 20, 22]; // 12 PM, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM
  const partyNames = [
    'Perera', 'Silva', 'Fernando', 'Jayasekera', 'Rajapaksha',
    'De Silva', 'Gunawardena', 'Wickramasinghe', 'Bandara', 'Senanayake',
    'Mendis', 'Alwis', 'Karunaratne', 'Dissanayake', 'Abeywickrama',
  ];

  await StaffParty.collection.deleteMany({ restaurantId, number: { $regex: '^P-' } });
  const partyOps: any[] = [];

  for (let dOffset = 0; dOffset < 14; dOffset++) {
    const baseDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dOffset);
    const dayPartyCount = dOffset === 0 ? 24 : dOffset === 1 ? 32 : (18 + ((dOffset * 7) % 15));

    for (let pIdx = 0; pIdx < dayPartyCount; pIdx++) {
      const numCode = `P-${dOffset}-${String(pIdx + 1).padStart(3, '0')}`;
      const hourVal = hourOffsets[pIdx % hourOffsets.length];
      const minuteVal = (pIdx * 11) % 55;
      const createdAt = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), hourVal, minuteVal, 0);

      const isQueue = pIdx % 3 !== 0; // 2/3 queue, 1/3 reservation
      const kind = isQueue ? 'queue' : 'reservation';

      let status: 'waiting' | 'almost-ready' | 'ready' | 'upcoming' | 'arrived' | 'seated' | 'cancelled' | 'no-show' = 'seated';
      let seatedAt: Date | undefined;
      let cancelledAt: Date | undefined;
      let bookingAt: Date | undefined;

      if (dOffset === 0) {
        // Today has live waiting queue and upcoming reservations
        if (isQueue) {
          if (pIdx < 4) {
            status = 'waiting';
          } else if (pIdx === 4) {
            status = 'almost-ready';
          } else if (pIdx === 5 || pIdx === 6) {
            status = 'cancelled';
            cancelledAt = new Date(createdAt.getTime() + 18 * 60000);
          } else {
            status = 'seated';
            const waitMin = 8 + (pIdx * 3) % 25;
            seatedAt = new Date(createdAt.getTime() + waitMin * 60000);
          }
        } else {
          if (pIdx % 4 === 0) {
            status = 'no-show';
          } else if (pIdx % 2 === 0) {
            status = 'upcoming';
            bookingAt = new Date(createdAt.getTime() + 60 * 60000);
          } else {
            status = 'seated';
            seatedAt = createdAt;
          }
        }
      } else {
        // Historical days (yesterday, last 7 days)
        if (isQueue) {
          if (pIdx % 6 === 0) {
            status = 'cancelled';
            cancelledAt = new Date(createdAt.getTime() + 20 * 60000);
          } else {
            status = 'seated';
            const waitMin = 10 + (pIdx * 4) % 28;
            seatedAt = new Date(createdAt.getTime() + waitMin * 60000);
          }
        } else {
          if (pIdx % 5 === 0) {
            status = 'no-show';
          } else {
            status = 'seated';
            seatedAt = createdAt;
          }
        }
      }

      const pName = `${partyNames[pIdx % partyNames.length]} Party`;
      const pSize = 2 + ((pIdx * 2) % 6);

      partyOps.push({
        updateOne: {
          filter: { restaurantId, number: numCode },
          update: {
            $set: {
              restaurantId,
              number: numCode,
              kind,
              customerName: pName,
              mobileNumber: `+94 77 ${100 + pIdx} ${2000 + pIdx}`,
              partySize: pSize,
              status,
              createdAt,
              updatedAt: createdAt,
              seatedAt,
              cancelledAt,
              bookingAt: bookingAt || createdAt,
              requestId: `req-${numCode}`,
              createdBy: 'system',
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (partyOps.length > 0) {
    await StaffParty.collection.bulkWrite(partyOps);
  }

  // 7. Seed Notifications
  const notificationsSample = [
    { message: 'High queue volume - 32 parties in queue', category: 'Queue' as const },
    { message: 'Walkaway detected - Party of 4 left the queue', category: 'Queue' as const },
    { message: 'Table T04 available - Was occupied for 1h 20m', category: 'System' as const },
    { message: 'End of day report ready - Thu, 24 Apr 2025', category: 'System' as const },
    { message: 'New reservation - R-2048 - 2 people at 8:00 PM', category: 'Reservations' as const },
    { message: 'High wait time - Average wait time is 32 min', category: 'Queue' as const },
  ];

  for (const n of notificationsSample) {
    const exists = await StaffNotification.findOne({ restaurantId, message: n.message });
    if (!exists) {
      await StaffNotification.create({
        restaurantId,
        message: n.message,
        category: n.category,
        readBy: [],
      });
    }
  }

  console.log('Seed complete! 30-day reports, historical parties, tables, accounts, and notifications are ready.');
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Setup failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
