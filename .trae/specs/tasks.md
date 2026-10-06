# QueueDine Implementation Tasks

Derived from spec.md. Parent ACs are cross-referenced.

---

## Task 1: Backend Models & Seed Data

**Status**: pending
**Priority**: high
**Depends on**: none

### Description

Create 4 mongoose models under `backend/src/models/`: Restaurant, Table, Reservation, QueueEntry. Add indexes for uniqueness constraints. Implement a seed utility that inserts "Ember & Oak" restaurant + sample tables on first startup if collection is empty.

### Files to create/modify

- Create `backend/src/models/Restaurant.ts`
- Create `backend/src/models/Table.ts`
- Create `backend/src/models/Reservation.ts`
- Create `backend/src/models/QueueEntry.ts`
- Modify `backend/src/server.ts` to invoke seed function after DB connect.

### Test Requirements (TR)

#### rule
TR-1.1. All 4 models compile and export correct TypeScript interfaces matching spec (fields, enums, refs, timestamps).
TR-1.2. Reservation model has unique compound index on `{ tableId, date, time, status: confirmed }`. Attempting to insert 2 confirmed reservations for same table/date/time → duplicate key error.
TR-1.3. QueueEntry model has unique compound index on `{ userId, restaurantId, status: waiting }`. Inserting 2 waiting for same user+restaurant → duplicate key error.
TR-1.4. Seed function runs on server start and creates exactly 1 Restaurant (Ember & Oak, Colombo, rating 4.6, 1200 reviews, hours 11-23) and ≥ 8 Table records (capacities 2,2,4,4,4,6,8,10, status=available) when collections are empty. Idempotent when already seeded.
Evidence: `curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/restaurants` returns 1 restaurant with correct fields.

### Maps to ACs: AC-1, AC-12

---

## Task 2: Backend Restaurant APIs

**Status**: pending
**Priority**: high
**Depends on**: Task 1

### Description

Create restaurant routes + controllers to: list restaurants, get by ID, get tables, get queue-stats. Wire into server.ts.

### Files

- Create `backend/src/controllers/restaurantController.ts`
- Create `backend/src/routes/restaurantRoutes.ts`
- Modify `backend/src/server.ts` → `app.use('/api/restaurants', restaurantRoutes)`

### Endpoints

- GET /api/restaurants → list (no auth required)
- GET /api/restaurants/:id → detail (no auth)
- GET /api/restaurants/:id/tables → list tables (no auth)
- GET /api/restaurants/:id/queue-stats → queue length + estimated wait (no auth)

### TR

#### rule
TR-2.1. GET /api/restaurants returns Ember & Oak record with populated computed fields (queueLength = count(QueueEntry waiting), availableTables = count(Table available), currentWaitTime from estimate).
TR-2.2. GET /api/restaurants/:id returns 404 for nonexistent ID.

### Maps to ACs: AC-1, AC-12

---

## Task 3: Backend Reservation APIs

**Status**: pending
**Priority**: high
**Depends on**: Task 1, Task 2

### Description

Implement all Reservation endpoints with JWT auth, ownership checks, availability checking, double-book prevention, and validation.

### Files

- Create `backend/src/controllers/reservationController.ts`
- Create `backend/src/routes/reservationRoutes.ts`
- Modify `backend/src/server.ts` → `app.use('/api/reservations', authMiddleware, reservationRoutes)`

### Endpoints (all behind authMiddleware)

- POST /api/reservations/check-availability
- POST /api/reservations (create)
- GET /api/reservations (user's own list)
- GET /api/reservations/:id (owner-only)
- PUT /api/reservations/:id (modify, owner-only)
- PUT /api/reservations/:id/cancel (owner-only)

### TR

#### rule
TR-3.1. POST create without token → 401.
TR-3.2. POST create with valid token but guests > table.capacity → 400 "Guests exceed table capacity".
TR-3.3. POST create with past date → 400.
TR-3.4. POST same table+date+time twice → second returns 409 "Table already booked for this slot"; DB has only one confirmed reservation.
TR-3.5. GET /api/reservations returns only records for req.user.userId (test using 2 different user tokens).
TR-3.6. GET /api/reservations/:id returns 403 when user A requests user B's reservation ID.
TR-3.7. PUT /:id/cancel → status becomes 'cancelled' and cannot be cancelled again.
TR-3.8. check-availability returns slot-level availability matching time-slots grid (6:00, 6:30, 7:00, 8:00, 8:30, 9:00 PM) with "available/limited/unavailable" labels.

### Maps to ACs: AC-1, AC-2, AC-6, AC-8, AC-9, AC-14

---

## Task 4: Backend Virtual Queue APIs

**Status**: pending
**Priority**: high
**Depends on**: Task 1, Task 2

### Description

Implement all Queue endpoints with backend-generated queueNumber, position recalculation, estimated wait, duplicate-prevention, and leave-queue.

### Files

- Create `backend/src/controllers/queueController.ts`
- Create `backend/src/routes/queueRoutes.ts`
- Modify `backend/src/server.ts` → `app.use('/api/queue', authMiddleware, queueRoutes)`

### Endpoints

- POST /api/queue/join
- GET /api/queue/active/:restaurantId
- GET /api/queue (history)
- GET /api/queue/:id/status (owner-only)
- PUT /api/queue/:id/cancel (owner-only, triggers position recalc)

### TR

#### rule
TR-4.1. POST join without token → 401.
TR-4.2. First join of the day for restaurant → queueNumber=1, position=1, estimatedWaitTime≈2 min (× position). Displays format Q-001 on frontend (formatting can be frontend concern).
TR-4.3. Second join → queueNumber=2, position=2.
TR-4.4. Join twice without cancelling → 2nd returns 409 "Already in active queue for this restaurant".
TR-4.5. Cancel user #1 while users #2 and #3 exist → after cancel their positions become 1 and 2 respectively (verify via status endpoint).
TR-4.6. GET /api/queue returns only the user's own entries.
TR-4.7. GET /api/queue/:id/status returns 403 for non-owner.

### Maps to ACs: AC-1, AC-3, AC-4, AC-7, AC-8, AC-9

---

## Task 5: Frontend Types & Service Modules

**Status**: pending
**Priority**: high
**Depends on**: none (can proceed in parallel with backend)

### Description

Create TypeScript types for Restaurant/Table/Reservation/QueueEntry. Create axios-wrapping service modules mirroring backend endpoints.

### Files

- Create `mobile/src/types/index.ts` (interfaces: Restaurant, Table, Reservation, QueueEntry, ApiError)
- Create `mobile/src/services/restaurantService.ts` (getRestaurants, getRestaurant, getTables, getQueueStats)
- Create `mobile/src/services/reservationService.ts` (checkAvailability, createReservation, getReservations, getReservation, cancelReservation, modifyReservation)
- Create `mobile/src/services/queueService.ts` (joinQueue, getActiveQueue, getQueueHistory, getQueueStatus, cancelQueue)

### TR

#### rule
TR-5.1. All service functions return typed Promises and correctly attach Bearer token via existing apiClient interceptor.
TR-5.2. Service calls use baseURL from existing EXPO_PUBLIC_API_URL via apiClient.

### Maps to ACs: AC-13

---

## Task 6: Frontend Navigation & Restaurant Details Screen

**Status**: pending
**Priority**: high
**Depends on**: Task 5

### Description

Update Expo Router layout with new routes. Build Restaurant Details (`restaurant.tsx`) matching Figma. Wire "Reserve a Table" and "Join Virtual Queue" navigation.

### Files

- Modify `mobile/app/_layout.tsx` → add routes: `restaurant`, `reservation/create`, `reservation/summary`, `reservation/[id]`, `reservations`, `queue/join`, `queue/ticket`, `queue/[id]`.
- Create `mobile/app/restaurant.tsx` → hero image, header with back+heart, tabs, stats, description, two buttons.
- Modify `mobile/app/home.tsx` → "Reserve a Table" button in restaurant card → `router.push('/restaurant')`; "Join Virtual Queue" → `router.push('/restaurant')`; bottom-nav "Bookings" tab → `router.push('/reservations')`.

### TR

#### rule
TR-6.1. Tapping buttons from home navigates to restaurant screen without error; back button returns to home.
TR-6.2. Restaurant screen renders all Figma sections (hero, name+location+rating, Overview/Menu/Info tabs, 4-row stats, description, 2 action buttons). Colors match theme (primary #8B0000, success #10B981 for wait time).
TR-6.3. Restaurant screen data loaded via `restaurantService.getRestaurant()`; stats reflect API data, not hardcoded.
TR-6.4. No visual regressions to existing home page content (greeting, logo, logout, features, bottom-nav).

### Maps to ACs: AC-5, AC-6, AC-7, AC-10

---

## Task 7: Frontend Reservation Flow (Create / Summary / Details / Bookings List)

**Status**: pending
**Priority**: high
**Depends on**: Task 6, Task 3 (backend)

### Description

Build 4 reservation screens wired to backend APIs.

### Files

- Create `mobile/app/reservation/create.tsx` (date, time, party size, available time slots grid, Continue button)
- Create `mobile/app/reservation/summary.tsx` (summary + confirm)
- Create `mobile/app/reservation/[id].tsx` (confirmation card, modify, cancel)
- Create `mobile/app/reservations.tsx` (list + empty state, bottom nav tab)
- Optionally modify theme constants only if missing spacing tokens.

### TR

#### rule
TR-7.1. Create reservation flow navigates: create → summary → POST createReservation → reservation/[id].
TR-7.2. Available time slots display "Available/Limited/Unavailable" per API check-availability. 8:30 PM appears disabled if unavailable.
TR-7.3. Reservation details screen shows Reservation ID, restaurant name, date, time, guests, table number, status badge.
TR-7.4. Cancel reservation action → Alert confirm → PUT cancel → status updates to "Cancelled" on screen.
TR-7.5. Bookings list shows user's own reservations; tapping navigates to details; empty state "No reservations yet" shown when empty.
TR-7.6. All screens show loading indicator during API calls and display error banner (red text) on failure; 401 clears token and redirects to /login via interceptor.

### Maps to ACs: AC-6, AC-9, AC-11, AC-10, AC-13

---

## Task 8: Frontend Virtual Queue Flow (Join / Ticket / Status)

**Status**: pending
**Priority**: high
**Depends on**: Task 6, Task 4 (backend)

### Description

Build 3 queue screens. Join form, ticket confirmation, tracking/status with polling.

### Files

- Create `mobile/app/queue/join.tsx` (party size, name, phone, special requests, wait time card, Join Queue button)
- Create `mobile/app/queue/ticket.tsx` (celebration checkmark, "You're in the Queue!", Q-XXX number, detail rows, Track My Queue button)
- Create `mobile/app/queue/[id].tsx` (live position, parties ahead, estimated wait updated every 10s, Leave Queue button)

### TR

#### rule
TR-8.1. Join Queue submit → POST joinQueue → success → ticket screen with queueNumber formatted Q-XXX (zero-padded 3 digits).
TR-8.2. Ticket screen shows all detail rows matching Figma.
TR-8.3. Queue status screen polls status every 10 seconds via `getQueueStatus` and updates position/parties/estimate.
TR-8.4. Leave Queue → alert confirm → PUT cancel → success → redirect to home.
TR-8.5. Duplicate queue join → error message shown "You are already in the queue for this restaurant"; no new record created.
TR-8.6. Full name and mobile number prefilled from AsyncStorage cached user (user.fullName, user.phone).

### Maps to ACs: AC-3, AC-7, AC-10, AC-11, AC-13

---

## Task 9: Integration, TypeCheck, Lint, & Manual Test Script

**Status**: pending
**Priority**: high
**Depends on**: Task 1-8

### Description

Run backend typecheck (`tsc --noEmit`), frontend typecheck (`npx tsc --noEmit`), frontend lint (`npx expo lint`). Verify the 14-step manual checklist items produce correct behavior by starting both servers and invoking endpoints via curl/Thunder-Client and running app in web mode.

### Files

- No new files. Fix any TS/lint errors found in files created in Tasks 1-8.

### TR

#### rule
TR-9.1. `backend/tsc --noEmit` exits 0.
TR-9.2. `mobile/npx tsc --noEmit` exits 0.
TR-9.3. `mobile/npx expo lint` exits 0 (no errors; warnings OK but prefer clean).
TR-9.4. Manual checklist items 1-14 from user request all complete with pass status recorded.
TR-9.5. MongoDB Compass/CLI verifies Reservation and QueueEntry collections contain the expected documents after flows run.

### Maps to ACs: AC-11, AC-5, AC-6, AC-7, AC-8

---

## Task 10: Independent Review

**Status**: pending
**Priority**: medium
**Depends on**: Task 9 all TR pass

### Description

Independent read-only review pass against spec ACs and TR evidence. Route any failures back to tasks as pending remediation.

Reviewer Contract:
- Read spec.md + tasks.md + review.md (once created)
- Inspect all new/modified files under backend/src and mobile/app + mobile/src
- Re-run typecheck/lint commands
- Verify at least 3 backend endpoints via curl (make-reservation, join-queue, ownership enforcement)
- Produce pass / fail / blocked result in review.md
- If fail → ≥ 1 actionable pending task in tasks.md

### Maps to ACs: All
