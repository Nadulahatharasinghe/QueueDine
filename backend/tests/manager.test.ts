import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { staffRoutes } from '../src/staff/routes';
import { managerRoutes } from '../src/manager/routes';
import { StaffAccount, StaffRestaurant, StaffTable, StaffParty, StaffSession, StaffEvent, StaffNotification, StaffAlert } from '../src/staff/models';
import { StaffReport } from '../src/manager/models';

test('manager portal backend integration in isolated replica set', { timeout: 1200000 }, async t => {
  process.env.STAFF_JWT_SECRET = 'isolated-manager-test-secret';
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } });
  await mongoose.connect(replica.getUri('queuedine_manager_test'));

  const app = express();
  app.use(express.json());
  app.use('/api/staff', staffRoutes);
  app.use('/api/manager', managerRoutes);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  const models = [StaffRestaurant, StaffAccount, StaffTable, StaffParty, StaffSession, StaffEvent, StaffNotification, StaffAlert, StaffReport];
  for (const model of models) await model.init();

  const hash = await bcrypt.hash('ManagerPass123!', 4);
  await StaffRestaurant.create({ _id: 'ember-oak', name: 'Ember & Oak', location: 'Colombo' });

  // Host account
  await StaffAccount.create({
    restaurantId: 'ember-oak',
    staffId: 'host-001',
    email: 'host@test.invalid',
    fullName: 'Tharindu Silva',
    passwordHash: hash,
    role: 'host',
  });

  // Manager account
  await StaffAccount.create({
    restaurantId: 'ember-oak',
    staffId: 'manager-001',
    email: 'manager@test.invalid',
    fullName: 'R. Perera',
    passwordHash: hash,
    role: 'manager',
  });

  // Tables
  for (let i = 1; i <= 9; i++) {
    await StaffTable.create({
      restaurantId: 'ember-oak',
      number: `T0${i}`,
      capacity: 4,
      status: i === 1 ? 'available' : i === 2 ? 'occupied' : 'available',
    });
  }

  let hostToken = '';
  let managerToken = '';

  const call = async (endpoint: string, method = 'GET', body?: unknown, auth = '') => {
    const response = await fetch(`${base}/api/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    return {
      status: response.status,
      data: response.status === 204 ? null : (isJson ? await response.json() : await response.text()),
    };
  };

  try {
    await t.test('authenticates host and manager, enforces manager role guard', async () => {
      // 1. Unauthenticated request to manager endpoint fails 401
      assert.equal((await call('manager/dashboard', 'GET', undefined, '')).status, 401);

      // 2. Host login
      const hostLogin = await call('staff/auth/login', 'POST', { identifier: 'host-001', password: 'ManagerPass123!' });
      assert.equal(hostLogin.status, 200);
      assert.equal(hostLogin.data.user.role, 'host');
      hostToken = hostLogin.data.token;

      // 3. Host accessing manager route is rejected with 403 Forbidden
      const hostAccess = await call('manager/dashboard', 'GET', undefined, hostToken);
      assert.equal(hostAccess.status, 403);
      assert.match(hostAccess.data.error, /Manager permissions required/i);

      // 4. Manager login
      const managerLogin = await call('staff/auth/login', 'POST', { identifier: 'manager-001', password: 'ManagerPass123!' });
      assert.equal(managerLogin.status, 200);
      assert.equal(managerLogin.data.user.role, 'manager');
      assert.equal(managerLogin.data.user.fullName, 'R. Perera');
      managerToken = managerLogin.data.token;

      // 5. Manager accessing manager dashboard succeeds with 200
      const managerAccess = await call('manager/dashboard', 'GET', undefined, managerToken);
      assert.equal(managerAccess.status, 200);
      assert.equal(managerAccess.data.restaurant.name, 'Ember & Oak');
      assert.ok(managerAccess.data.keyMetrics.occupancy !== undefined);
    });

    await t.test('manager analytics and live operations return expected operational metrics', async () => {
      const ops = await call('manager/live-overview', 'GET', undefined, managerToken);
      assert.equal(ops.status, 200);
      assert.equal(ops.data.tables.length, 9);

      const occ = await call('manager/analytics/occupancy', 'GET', undefined, managerToken);
      assert.equal(occ.status, 200);
      assert.ok(typeof occ.data.avgOccupancy.value === 'number');

      const queue = await call('manager/analytics/queue', 'GET', undefined, managerToken);
      assert.equal(queue.status, 200);
      assert.ok(queue.data.waitTimeDistribution.length > 0);

      const walk = await call('manager/analytics/walkaways', 'GET', undefined, managerToken);
      assert.equal(walk.status, 200);
      assert.ok(typeof walk.data.walkaways.count === 'number');
    });

    let createdReportId = '';

    await t.test('full Reports CRUD: Create, Read, Update, Delete', async () => {
      // 1. CREATE: Generate and save report for 2025-04-24
      const createRes = await call('manager/reports', 'POST', { date: '2025-04-24', notes: 'Initial review' }, managerToken);
      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.date, '2025-04-24');
      assert.equal(createRes.data.notes, 'Initial review');
      createdReportId = createRes.data._id;
      assert.ok(createdReportId);

      // 2. READ: List all reports in history
      const listRes = await call('manager/reports', 'GET', undefined, managerToken);
      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.data));
      assert.ok(listRes.data.some((r: any) => r._id === createdReportId));

      // 3. READ: Fetch single report
      const singleRes = await call(`manager/reports/${createdReportId}`, 'GET', undefined, managerToken);
      assert.equal(singleRes.status, 200);
      assert.equal(singleRes.data._id, createdReportId);

      // 4. UPDATE: Update report notes
      const updateRes = await call(`manager/reports/${createdReportId}`, 'PATCH', { notes: 'Updated notes' }, managerToken);
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.notes, 'Updated notes');

      // 4b. EXPORT: Download CSV export
      const csvRes = await call(`manager/reports/${createdReportId}/csv`, 'GET', undefined, managerToken);
      assert.equal(csvRes.status, 200);
      assert.ok(csvRes.data.includes('QueueDine End-of-Day Operations Report'));
      assert.ok(csvRes.data.includes('2025-04-24'));

      // 5. DELETE: Remove report from database
      const deleteRes = await call(`manager/reports/${createdReportId}`, 'DELETE', undefined, managerToken);
      assert.equal(deleteRes.status, 204);

      // Verify report is deleted
      const verifyRes = await call(`manager/reports/${createdReportId}`, 'GET', undefined, managerToken);
      assert.equal(verifyRes.status, 404);
    });
  } finally {
    server.close();
    await mongoose.disconnect();
    await replica.stop();
  }
});
