import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { chromium } from '@playwright/test';
import { staffRoutes, releaseExpiredHolds } from '../src/staff/routes';
import { StaffAccount, StaffRestaurant, StaffTable, StaffParty, StaffSession, StaffEvent, StaffNotification, StaffAlert } from '../src/staff/models';
import { seedStaffAccount } from '../src/staff/seedAccount';
import authRoutes from '../src/routes/authRoutes';
import User from '../src/models/User';

test('staff portal integration in an isolated replica set', { timeout: 1200000 }, async t => {
  // Never load .env: these tests cannot connect to the shared Atlas database.
  process.env.STAFF_JWT_SECRET = 'isolated-staff-test-secret';
  process.env.JWT_SECRET = 'isolated-customer-test-secret';
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } });
  await mongoose.connect(replica.getUri('queuedine_staff_test'));
  const app = express(); app.use(express.json()); app.use('/api/staff', staffRoutes); app.use('/api/auth', authRoutes);
  const web = path.resolve('../mobile/.expo/staff-portal-web-check');
  if (existsSync(web)) { app.use(express.static(web, { dotfiles: 'allow' })); app.get('/staff/{*rest}', (_req, res) => res.sendFile(path.join(web, 'index.html'), { dotfiles: 'allow' })); }
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number }, base = `http://127.0.0.1:${address.port}`;
  const models = [StaffRestaurant, StaffAccount, StaffTable, StaffParty, StaffSession, StaffEvent, StaffNotification, StaffAlert, User];
  for (const model of models) await model.init();
  const hash = await bcrypt.hash('TestStaffPass123!', 4);
  await StaffRestaurant.create([{ _id: 'a', name: 'Ember & Oak', location: 'Colombo' }, { _id: 'b', name: 'Other Restaurant' }]);
  const a = await StaffAccount.create({ restaurantId: 'a', staffId: 'host-001', email: 'host@test.invalid', fullName: 'Tharindu Silva', passwordHash: hash });
  await StaffAccount.create({ restaurantId: 'b', staffId: 'host-002', email: 'other@test.invalid', fullName: 'Other Host', passwordHash: hash });
  const table1 = await StaffTable.create({ restaurantId: 'a', number: 'T01', capacity: 4 });
  const table2 = await StaffTable.create({ restaurantId: 'a', number: 'T02', capacity: 4 });
  const otherTable = await StaffTable.create({ restaurantId: 'b', number: 'T99', capacity: 4 });
  let token = '';
  const call = async (endpoint: string, method = 'GET', body?: unknown, auth = token, key = randomUUID()) => {
    const response = await fetch(`${base}/api/${endpoint}`, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  const details = { customerName: 'Kavindu Perera', mobileNumber: '+94 77 123 4567', partySize: 4, specialRequests: 'Window seat', kind: 'queue' };
  let partyId = '', reservationId = '';
  try {
    await t.test('authentication blocks unauthenticated and customer access', async () => {
      assert.equal((await call('staff/dashboard', 'GET', undefined, '')).status, 401);
      const customer = await call('auth/register', 'POST', { fullName: 'Customer', email: 'customer@test.invalid', password: 'CustomerPass123!' }, '');
      assert.equal(customer.status, 201);
      assert.equal((await call('staff/dashboard', 'GET', undefined, customer.data.token)).status, 401);
      assert.equal((await call('staff/auth/login', 'POST', { identifier: 'customer@test.invalid', password: 'CustomerPass123!' }, '')).status, 401);
      const login = await call('staff/auth/login', 'POST', { identifier: 'host-001', password: 'TestStaffPass123!' }, '');
      assert.equal(login.status, 200); assert.equal(login.data.user.fullName, 'Tharindu Silva'); assert.equal(login.data.user.passwordHash, undefined);
      token = login.data.token;
      const wrongAudience = jwt.sign({ accountId: a._id }, process.env.STAFF_JWT_SECRET!);
      assert.equal((await call('staff/dashboard', 'GET', undefined, wrongAudience)).status, 401);
    });
    await t.test('seeded host password reset is scoped and produces a staff JWT', async () => {
      const seededPassword = 'SeededHostPass123!';
      const otherPassword = 'OtherStaffPass123!';
      const otherHash = await bcrypt.hash(otherPassword, 4);
      const seededHost = await StaffAccount.findById(a._id).select('+passwordHash');
      assert.ok(seededHost);
      await StaffAccount.updateOne(
        { _id: seededHost._id },
        { $set: { email: 'host@queuedine.local', restaurantId: 'ember-oak' } },
      );
      const otherStaff = await StaffAccount.create({
        restaurantId: 'b', staffId: 'other-003', email: 'other@queuedine.local',
        fullName: 'Other Staff', passwordHash: otherHash,
      });

      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        await seedStaffAccount({
          restaurantId: 'ember-oak', staffId: 'host-001', email: 'host@queuedine.local',
          fullName: 'Seeded Host', password: seededPassword, resetPassword: true,
        });

        const updated = await StaffAccount.findById(seededHost._id).select('+passwordHash');
        assert.ok(updated);
        assert.equal(await bcrypt.compare(seededPassword, updated.passwordHash), true);
        assert.equal(await bcrypt.compare('TestStaffPass123!', updated.passwordHash), false);
        const unchangedOther = await StaffAccount.findById(otherStaff._id).select('+passwordHash');
        assert.ok(unchangedOther);
        assert.equal(await bcrypt.compare(otherPassword, unchangedOther.passwordHash), true);

        const login = await call('staff/auth/login', 'POST', {
          identifier: 'host@queuedine.local', password: seededPassword,
        }, '');
        assert.equal(login.status, 200);
        assert.equal(login.data.user.staffId, 'host-001');
        assert.equal(login.data.user.restaurantId, 'ember-oak');
        assert.equal(login.data.user.passwordHash, undefined);
        const claims = jwt.verify(login.data.token, process.env.STAFF_JWT_SECRET!, {
          audience: 'queuedine-staff',
        }) as jwt.JwtPayload;
        assert.equal(claims.accountId, seededHost._id);
        assert.ok(claims.sessionId);

        await assert.rejects(seedStaffAccount({
          restaurantId: 'b', staffId: 'other-003', email: 'other@queuedine.local',
          fullName: 'Other Staff', password: 'ShouldNotCreate123!', resetPassword: true,
        }), /restricted to the seeded host account/);
        process.env.NODE_ENV = 'production';
        await assert.rejects(seedStaffAccount({
          restaurantId: 'ember-oak', staffId: 'host-001', email: 'host@queuedine.local',
          fullName: 'Seeded Host', password: 'ShouldNotReset123!', resetPassword: true,
        }), /only in local development/);
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        await StaffAccount.updateOne(
          { _id: seededHost._id },
          {
            $set: {
              email: 'host@test.invalid',
              restaurantId: 'a',
              passwordHash: seededHost.passwordHash,
            },
          },
        );
      }
    });
    await t.test('validates forms and saves retries only once', async () => {
      assert.equal((await call('staff/parties', 'POST', { ...details, partySize: 0 })).status, 400);
      assert.equal((await call('staff/parties', 'POST', { ...details, mobileNumber: 'bad' })).status, 400);
      const key = randomUUID();
      const first = await call('staff/parties', 'POST', details, token, key), second = await call('staff/parties', 'POST', details, token, key);
      assert.equal(first.status, 201); assert.equal(first.data._id, second.data._id); partyId = first.data._id;
      assert.equal(await StaffParty.countDocuments({ requestId: key }), 1);
      const dash = await call('staff/dashboard'); assert.equal(dash.data.waiting, 1);
      assert.equal((await call(`staff/parties/${partyId}`, 'PATCH', { ...details, customerName: 'Updated Customer', action: 'edit' })).status, 200);
    });
    await t.test('scopes all data and mutations to the restaurant', async () => {
      const tables = await call('staff/tables'); assert.equal(tables.data.length, 2);
      assert.equal((await call(`staff/tables/${otherTable._id}`)).status, 404);
      assert.equal((await call(`staff/tables/${otherTable._id}`, 'PATCH', { status: 'occupied' })).status, 404);
      assert.equal((await call('staff/assign', 'POST', { partyId, tableId: otherTable._id })).status, 404);
      assert.equal((await StaffTable.findById(otherTable._id))!.status, 'available');
    });
    await t.test('records early and ready alerts, read state, and activity', async () => {
      const key = randomUUID();
      assert.equal((await call('staff/alerts', 'POST', { partyId, stage: 'almost-ready' }, token, key)).status, 201);
      await call('staff/alerts', 'POST', { partyId, stage: 'almost-ready' }, token, key);
      assert.equal(await StaffAlert.countDocuments({ requestId: key }), 1);
      assert.equal((await call(`staff/parties/${partyId}`)).data.status, 'almost-ready');
      await call('staff/alerts', 'POST', { partyId, stage: 'ready' });
      assert.equal((await call(`staff/parties/${partyId}`)).data.status, 'ready');
      const inbox = await call('staff/notifications'); assert.ok(inbox.data.length >= 3);
      await call(`staff/notifications/${inbox.data[0]._id}/read`, 'PATCH', {});
      assert.equal((await call('staff/notifications')).data[0].read, true);
      assert.ok((await call(`staff/activity?partyId=${partyId}`)).data.length >= 3);
    });
    await t.test('concurrent seating claims a table once and preserves consistency', async () => {
      const second = await call('staff/parties', 'POST', { ...details, customerName: 'Second Customer' });
      const results = await Promise.all([call('staff/assign', 'POST', { partyId, tableId: table1._id }), call('staff/assign', 'POST', { partyId: second.data._id, tableId: table1._id })]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      const assigned = await StaffTable.findById(table1._id);
      assert.equal(assigned!.status, 'occupied');
      const p = await StaffParty.findById(assigned!.partyId!); assert.equal(p!.status, 'seated'); assert.equal(p!.tableId, table1._id);
      assert.equal(await StaffParty.countDocuments({ tableId: table1._id, status: 'seated' }), 1);
      assert.equal((await call(`staff/tables/${table1._id}`, 'PATCH', { status: 'available' })).status, 409);
      assert.equal((await call(`staff/tables/${table1._id}`, 'PATCH', { status: 'cleaning' })).status, 200);
      assert.equal((await call(`staff/tables/${table1._id}`, 'PATCH', { status: 'available' })).status, 200);
    });
    await t.test('holds extend and expire even without an open app', async () => {
      const r = await call('staff/parties', 'POST', { ...details, kind: 'reservation', bookingAt: new Date(Date.now() + 600000).toISOString() });
      assert.equal(r.status, 201); reservationId = r.data._id;
      assert.equal((await call('staff/assign', 'POST', { partyId: reservationId, tableId: table2._id, mode: 'hold' })).status, 200);
      const held = await StaffTable.findById(table2._id); assert.equal(held!.status, 'reserved');
      assert.equal((await call(`staff/parties/${reservationId}`, 'PATCH', { ...details, action: 'edit', partySize: 6 })).status, 409);
      const oldExpiry = held!.holdExpiresAt!.getTime();
      assert.equal((await call(`staff/parties/${reservationId}`, 'PATCH', { action: 'extend' })).status, 200);
      assert.equal((await StaffTable.findById(table2._id))!.holdExpiresAt!.getTime(), oldExpiry + 600000);
      await StaffTable.updateOne({ _id: table2._id }, { holdExpiresAt: new Date(Date.now() - 1000) });
      assert.equal((await call('staff/assign', 'POST', { partyId: reservationId, tableId: table2._id, mode: 'seat' })).status, 409);
      await releaseExpiredHolds();
      assert.equal((await StaffTable.findById(table2._id))!.status, 'available');
      assert.equal((await StaffParty.findById(reservationId))!.status, 'no-show');
      assert.equal((await call(`staff/parties/${reservationId}`, 'PATCH', { action: 'extend' })).status, 409);
    });
    await t.test('cancellation releases a reservation hold; preferences persist', async () => {
      const r = await call('staff/parties', 'POST', { ...details, kind: 'reservation', bookingAt: new Date(Date.now() + 600000).toISOString() });
      await call('staff/assign', 'POST', { partyId: r.data._id, tableId: table2._id, mode: 'hold' });
      assert.equal((await call(`staff/parties/${r.data._id}`, 'PATCH', { action: 'cancel' })).status, 200);
      assert.equal((await StaffTable.findById(table2._id))!.status, 'available');
      await call('staff/me', 'PATCH', { queueAlerts: false, onDuty: false });
      assert.equal((await call('staff/me')).data.user.onDuty, false);
      assert.ok((await call('staff/notifications')).data.every((n: { category: string }) => n.category !== 'Queue'));
      assert.equal(await User.countDocuments(), 1);
    });
    await t.test('browser protects deep links and completes walk-in navigation', async () => {
      if (!existsSync(web)) { t.diagnostic('Export the web app first to enable browser verification.'); return; }
      const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      const browserPath = existsSync(chromium.executablePath()) ? chromium.executablePath() : existsSync(edge) ? edge : undefined;
      const browser = await chromium.launch({ headless: true, timeout: 15000, ...(browserPath ? { executablePath: browserPath } : {}) });
      try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.setDefaultTimeout(15000);
        page.setDefaultNavigationTimeout(15000);
        const pageErrors: string[] = []; page.on('pageerror', e => pageErrors.push(e.message));
        await page.route('**/api/staff/**', async route => {
          const req = route.request();
          const result = await route.fetch({ url: `${base}${new URL(req.url()).pathname}${new URL(req.url()).search}` });
          await route.fulfill({ response: result, headers: { ...result.headers(), 'access-control-allow-origin': '*' } });
        });
        await page.goto(`${base}/staff/tables`);
        await page.getByText('Staff Login', { exact: true }).waitFor();
        await page.getByLabel('Staff ID or email', { exact: true }).fill('host-001');
        await page.getByLabel('Password', { exact: true }).fill('TestStaffPass123!');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.getByRole('button', { name: '＋ Add Walk-in', exact: true }).waitFor();
        await page.screenshot({ path: '../mobile/.expo/staff-dashboard-preview.png', fullPage: true });
        await page.getByRole('button', { name: '＋ Add Walk-in', exact: true }).click();
        await page.getByLabel('Customer name', { exact: true }).fill('Browser Customer');
        await page.getByLabel('Mobile number', { exact: true }).fill('+94 77 222 3333');
        await page.getByRole('button', { name: 'Add to Queue', exact: true }).click();
        await page.getByText('Browser Customer', { exact: true }).waitFor();
        await page.getByRole('button', { name: '＋ Add Walk-in', exact: true }).waitFor();
        const filterBox = await page.getByRole('button', { name: 'All', exact: true }).boundingBox();
        assert.ok(filterBox && filterBox.height <= 48, 'Queue filters must keep compact touch targets');
        const footerBox = await page.getByRole('tab', { name: 'Queue', exact: true }).boundingBox();
        assert.ok(footerBox && footerBox.y + footerBox.height <= 844, 'Queue navigation must remain within the phone viewport');
        await page.screenshot({ path: '../mobile/.expo/staff-queue-preview.png', fullPage: true });
        await page.getByText('Browser Customer', { exact: true }).click();
        await page.getByRole('button', { name: 'Assign Table', exact: true }).click();
        await page.getByRole('button', { name: /T01/ }).click();
        await page.getByRole('button', { name: 'Assign T01', exact: true }).click();
        await page.getByText('Table Updated!', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await page.getByRole('button', { name: /T01, 4 seats, occupied/ }).waitFor();
        await page.screenshot({ path: '../mobile/.expo/staff-tables-preview.png', fullPage: true });
        await page.getByRole('tab', { name: 'More', exact: true }).click();
        await page.getByRole('button', { name: 'Logout', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm Logout', exact: true }).click();
        await page.getByText('Staff Login', { exact: true }).waitFor();
        assert.deepEqual(pageErrors, []);
      } finally { await browser.close(); }
    });
    await t.test('logout revokes the token and disabled accounts lose access', async () => {
      const login = await call('staff/auth/login', 'POST', { identifier: 'host-001', password: 'TestStaffPass123!' }, '');
      await StaffAccount.updateOne({ _id: a._id }, { isActive: false });
      assert.equal((await call('staff/me', 'GET', undefined, login.data.token)).status, 401);
      await StaffAccount.updateOne({ _id: a._id }, { isActive: true });
      assert.equal((await call('staff/auth/logout', 'POST', {})).status, 204);
      assert.equal((await call('staff/me')).status, 401);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await mongoose.disconnect(); await replica.stop();
  }
});
