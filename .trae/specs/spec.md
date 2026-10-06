# QueueDine: Table Reservation & Virtual Queue Specification

## Problem

QueueDine users currently have no way to reserve tables or join virtual queues at restaurants. The home page displays "Reserve a Table" and "Join Virtual Queue" buttons with no implementation. This spec implements both features end-to-end, reusing the existing authentication (JWT), MongoDB connection, UI components (CustomButton, CustomInput, ScreenContainer, theme), and Expo Router navigation.

## Users

- **Authenticated Customers**: Logged-in users who want to reserve a table or join a virtual queue at Ember & Oak restaurant.

## Goals

1. Implement the complete Table Reservation flow: Home → Restaurant Details → Reserve Table → Date/Time/Guests → Summary → Confirm → Reservation Details.
2. Implement the complete Virtual Queue flow: Restaurant → Join Queue → Guests → Confirm → Queue Ticket → Queue Status.
3. All data persists in the existing MongoDB Cloud database via authenticated backend APIs.
4. UI matches the Figma screenshots exactly (colors, layout, buttons, cards, spacing, fonts, icons, navigation).
5. Existing features (Registration, Login, Home, Profile) continue to work without modification.

## Non-Goals

- No restaurant staff/admin interface.
- No push notification infrastructure beyond in-app status updates.
- No new authentication system or MongoDB connection.
- No multi-restaurant UI (only Ember & Oak as shown in Figma).
- No payment processing.
- No modification to unrelated team members' work.

---

## Functional Requirements

### Backend

#### 1. MongoDB Models

**Restaurant Model**
- Fields: `name`, `location`, `rating`, `reviewCount`, `imageUrl`, `description`, `openingHours`, `currentWaitTime`, `queueLength`, `availableTables`, `cuisine`, `createdAt`, `updatedAt`
- At least one seed record: "Ember & Oak", "Colombo, Sri Lanka", rating 4.6, 1200 reviews.

**Table Model**
- Fields: `restaurantId` (ref: Restaurant), `tableNumber`, `capacity` (min 1), `status` (enum: available, reserved, occupied), `createdAt`, `updatedAt`
- Seed with ~10 tables of varying capacities (2-10 people).

**Reservation Model**
- Fields: `userId` (ref: User, required), `restaurantId` (ref: Restaurant, required), `tableId` (ref: Table, required), `date` (ISO date string, required), `time` (HH:mm string, required), `guests` (number 1-20, required), `status` (enum: pending, confirmed, cancelled, completed, default: confirmed), `specialRequests` (string, optional), `createdAt`, `updatedAt`
- Unique compound index on `{ tableId, date, time, status: confirmed }` to prevent double-booking of the same table at the same slot.

**QueueEntry Model**
- Fields: `userId` (ref: User, required), `restaurantId` (ref: Restaurant, required), `queueNumber` (number, backend-generated, unique per restaurant per day), `guests` (number 1-20, required), `position` (number, backend-calculated), `estimatedWaitTime` (number in minutes, backend-calculated), `status` (enum: waiting, called, seated, cancelled, default: waiting), `specialRequests` (string, optional), `joinedAt`, `calledAt`, `seatedAt`, `cancelledAt`, `createdAt`, `updatedAt`
- Only one `waiting` entry per user per restaurant at any time (unique compound index on `{ userId, restaurantId, status: waiting }`).

#### 2. Reservation API Endpoints

All endpoints require valid JWT via `authMiddleware`. `userId` is never accepted from the request body; it is always read from `req.user.userId`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/restaurants` | List restaurants with stats (wait time, queue, available tables) |
| GET | `/api/restaurants/:id` | Get single restaurant details |
| GET | `/api/restaurants/:id/tables` | Get tables for a restaurant |
| POST | `/api/reservations/check-availability` | Check availability: accepts `{ restaurantId, date, time, guests }`, returns available tables & slot status |
| POST | `/api/reservations` | Create reservation: accepts `{ restaurantId, tableId, date, time, guests, specialRequests? }`. Validates no double-booking, assigns authenticated userId. Returns reservation. |
| GET | `/api/reservations` | Get current user's reservations (all statuses, newest first). Populates restaurant & table. |
| GET | `/api/reservations/:id` | Get single reservation by ID. **Authorization**: only the reservation owner (matching `req.user.userId`) may view. 403 otherwise. |
| PUT | `/api/reservations/:id/cancel` | Cancel reservation. Owner-only. Sets `status: cancelled`. |
| PUT | `/api/reservations/:id` | Modify reservation (date/time/guests/table). Owner-only. Re-validates availability. |

Validation rules:
- `guests` 1-20; must not exceed selected table capacity.
- `date` must be today or future.
- `time` must be within restaurant operating hours.
- Cannot cancel a reservation whose time has already passed.

#### 3. Virtual Queue API Endpoints

All endpoints require JWT. `userId` comes from `req.user.userId`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/queue/join` | Join queue: accepts `{ restaurantId, guests, specialRequests? }`. Generates `queueNumber`, calculates `position` and `estimatedWaitTime`. Prevents duplicate waiting entries. Returns queue entry. |
| GET | `/api/queue/active/:restaurantId` | Get authenticated user's active (waiting) queue entry for restaurant, if any. Also returns current queue stats (total parties ahead). |
| GET | `/api/queue` | Get authenticated user's queue history (all entries, newest first). Populates restaurant. |
| GET | `/api/queue/:id/status` | Get current queue status for entry by ID: updated position, estimated wait, parties ahead. Owner-only. |
| PUT | `/api/queue/:id/cancel` | Leave queue. Owner-only. Sets `status: cancelled`, records `cancelledAt`. Recalculates positions for remaining waiting entries. |
| GET | `/api/restaurants/:id/queue-stats` | Public: current queue length, estimated wait, parties ahead (summary). |

Queue logic:
- `queueNumber`: Incrementing counter per restaurant per day (e.g., first join → 1 → displays as "Q-001").
- `position`: Count of `waiting` entries joined before this one, plus 1. Recomputed on join/cancel/called/seated.
- `estimatedWaitTime`: `position * averageWaitPerParty` (default 25 min / 12 parties ≈ 2 min per party; configurable).
- On any status change from `waiting`, remaining `waiting` entries' positions recalculate atomically.

---

### Frontend

#### 4. Screens & Navigation (Expo Router)

Create/modify files in `mobile/app/` and `mobile/src/`:

**Navigation additions** (`_layout.tsx`):
Register new routes: `restaurant`, `reservation/create`, `reservation/summary`, `reservation/[id]`, `reservations`, `queue/join`, `queue/ticket`, `queue/[id]`.

**Restaurant Details Screen** (`restaurant.tsx`)
- Figma match: Hero image area, "Ember & Oak" name, location, rating (★ 4.6 (1.2k reviews)), Overview/Menu/Info tabs (Overview active), stats row (Open Today 11AM-11PM, Current Wait Time ~25 min green, Queue Length 12 parties, Available Tables 8 tables), description paragraph.
- Buttons: Solid maroon "Reserve a Table" (→ reservation/create), outline maroon "Join Virtual Queue" (→ queue/join).
- Data from `/api/restaurants/:id` (Ember & Oak ID).
- Back button in top-left, heart icon in top-right.

**Make a Reservation Screen** (`reservation/create.tsx`)
- Title: "Make a Reservation" with back button.
- Fields:
  - Date: styled input with calendar icon, format `Fri, 25 Apr 2025`.
  - Time: dropdown, default 7:00 PM.
  - Party Size: dropdown, default 4 people.
- Section: "Available Time Slots" grid of 6 chips (6:00 PM Limited red, 6:30 PM Available green, 7:00 PM Available selected-green, 8:00 PM Limited, 8:30 PM Unavailable gray, 9:00 PM Available). Chip availability from `/api/reservations/check-availability`.
- Primary button "Continue" → reservation/summary.

**Reservation Summary + Confirm** (in `reservation/summary.tsx`)
- Shows restaurant, selected date, time, party size, table info.
- "Confirm Reservation" button → POST `/api/reservations`.
- On success → navigate to `reservation/[id]`.
- Handle loading, API/validation errors, unauthorized.

**Reservation Details Screen** (`reservation/[id].tsx`)
- Confirmation card with ✅ icon, "Reservation Confirmed!" header.
- Fields: Reservation ID, Restaurant, Date, Time, Party Size, Table, Status (badge).
- Actions: "Modify Reservation" (opens edit) and "Cancel Reservation" (alert confirm → PUT cancel → refresh).
- Unauthorized users redirected to login.

**Bookings Screen** (`reservations.tsx`)
- Accessible via bottom-nav "Bookings" tab.
- Lists user's reservations via GET `/api/reservations`.
- Empty state: "No reservations yet".
- Loading / error states.
- Tap → reservation/[id].

**Join Virtual Queue Screen** (`queue/join.tsx`)
- Title: "Join Virtual Queue". Subtext: "We'll notify you when your table is almost ready...".
- Fields:
  - Party Size dropdown (4 people default).
  - Full Name (prefilled from user profile).
  - Mobile Number (prefilled from user profile, optional).
  - Special Requests (optional, multiline).
- Estimated Wait Time card (green bg, clock icon, ~25 min, 12 parties ahead).
- Primary button "Join Queue" → POST `/api/queue/join`. On success → queue/ticket.
- Duplicate-waiting error → "You are already in the queue for this restaurant" message.

**Queue Ticket Confirmation** (`queue/ticket.tsx`)
- Celebration: checkmark badge with confetti dots.
- "You're in the Queue!" title. Queue Number `Q-018` large maroon.
- Rows: Restaurant (Ember & Oak), Party Size (4 people), Joined Time (Today 6:45 PM), Estimated Wait (~25 min green), Parties Ahead (12).
- Subtext note.
- Button: "Track My Queue" → queue/[id].

**Queue Status Tracker** (`queue/[id].tsx`)
- Polls `/api/queue/:id/status` every 10 seconds OR refetches on focus.
- Shows updated position, parties ahead, estimated wait, current queue number being called.
- "Leave Queue" button → PUT cancel → confirm alert → redirect home.

#### 5. Shared UI/UX

- Reuse `CustomButton`, `CustomInput`, `ScreenContainer`, `Logo` from existing components.
- Colors strictly follow `theme.ts`: primary `#8B0000` (maroon), success `#10B981` (green), border `#E0E0E0`, etc.
- All screens handle: loading spinners, error messages, empty states, 401 redirect to login.
- Unauthenticated users attempting to access reservation/queue screens are redirected to `/login`.
- Bottom nav "Bookings" tab in home.tsx links to `/reservations`.

#### 6. Frontend Services

- New file `mobile/src/services/reservationService.ts`: wrapper functions for reservation API calls.
- New file `mobile/src/services/queueService.ts`: wrapper functions for queue API calls.
- New file `mobile/src/services/restaurantService.ts`: fetch restaurant(s) + queue stats.
- Extend `mobile/src/types/auth.ts` → add new types file `mobile/src/types/index.ts` with Restaurant, Table, Reservation, QueueEntry interfaces.

---

## Non-Functional Requirements

1. **Security**: userId never accepted from frontend; always derived from JWT. All reservation/queue endpoints enforce ownership checks.
2. **Validation**: All create/update payloads validated on backend (zod/manual checks returning 400). Return structured errors with an `error` message string.
3. **Idempotency**: Double-submit of reservation/queue join must not create duplicates.
4. **Persistence**: All data stored in the existing MongoDB Cloud using the existing mongoose connection & env var.
5. **No regressions**: Existing auth, user, settings endpoints + login/register/profile/home screens continue to pass existing behavior.
6. **Figma fidelity**: UI pixel-match to uploaded screenshots (color values, spacing, border radii, typography scale, button styles).
7. **Offline graceful degradation**: Network errors display user-friendly messages; cached user data shown when possible.

---

## Constraints, Dependencies, Assumptions

- **Dependencies**: All backend deps already present (express, mongoose, jsonwebtoken, bcryptjs, cors, dotenv, multer). Frontend deps present: expo-router v57, axios, @react-native-async-storage/async-storage, react-native-safe-area-context. No new npm installs required unless explicitly approved.
- **MongoDB**: Uses existing `MONGODB_URI` env var. Backend creates models and connects; seed on first run if Restaurant collection is empty.
- **Restaurant ID**: Hardcode the Ember & Oak document ID in frontend routes after seeding, or use a `GET /api/restaurants` list and pick the first record.
- **Operating hours**: Assume 11:00 AM to 11:00 PM (30-min reservation slots).
- **Average wait per party**: 2 minutes per party for estimate (so 12 ahead ≈ 24 → displays "~25 minutes").
- **Date/Time picker**: Use native `<input type>` style dropdown chips / date modal with matching styling from theme (no third-party picker unless already available).
- **Icons**: Use emoji text icons as in existing screens (no icon library dependency).

## Open Questions (Resolved by Assumption)

1. Does the user want to seed more than one restaurant? → Assumption: No. Seed only Ember & Oak as in Figma.
2. Should reservation modification be full-featured as shown in the "Modify Reservation" screenshot? → Yes, include PUT update endpoint and modify UI as part of reservation details.
3. Queue number format? → Q-XXX padded to 3 digits.

---

## Acceptance Criteria

### rule

AC-1. All 6 new backend endpoints for Reservation and 6 for Queue return correct responses with JWT auth enforced. 401 returned on missing/invalid token. 403 on cross-user access attempt.

AC-2. Reservation double-book prevention: creating 2 reservations for the same tableId+date+time returns 409 error; only 1 record exists in DB.

AC-3. Queue duplicate-prevention: joining queue twice without cancelling returns 409 for the second attempt.

AC-4. On queue join/cancel/seated, remaining waiting entries' `position` values are correctly recalculated (verify via GET /api/queue/:id/status).

AC-5. Home page existing content and navigation to login, register, profile continues to work without visual or functional regression.

AC-6. Login → Home → Restaurant Details → Reserve Table flow completes successfully, reservation document created in MongoDB with correct userId from JWT.

AC-7. Restaurant → Join Virtual Queue flow completes successfully, queue document created with backend-generated queueNumber, position=1 if first, correct estimatedWaitTime.

AC-8. Reservation and queue list endpoints (`GET /api/reservations`, `GET /api/queue`) return only the authenticated user's own records, never another user's.

AC-9. Cancelling a reservation or queue updates status to `cancelled` and record persists with timestamp.

AC-10. Frontend screens visually match provided Figma screenshots (colors, layout, buttons, cards, spacing, fonts, icons) to within reasonable responsive rendering.

AC-11. All 14 user-specified manual tests pass: login, home, select restaurant, make reservation, verify in MongoDB, cancel reservation, join queue, verify ticket, verify position/wait, refresh persistence, cancel queue, duplicate test, unauthorized test, existing features intact.

### rubric

AC-12. **Code Architecture (0-5)**:
  - 0: No separation of concerns.
  - 1-2: Working but messy; logic duplicated between controllers; no service layer pattern.
  - 3: Follows existing authService / controller / route / model pattern. Models, routes, controllers in correct files matching naming convention.
  - 4-5: Clean separation, utility helpers for position recalculation, DRY, consistent error handling style matching existing authController.
  - Pass threshold: ≥ 3.

AC-13. **Frontend Code Organization (0-5)**:
  - 0: All code dumped in single files, no services or types.
  - 1-2: Screens work but use inline axios and `any` types everywhere.
  - 3: Screens use dedicated service modules, TypeScript interfaces, reusable components (CustomButton/Input/Container).
  - 4-5: Consistent state management (loading/error/success), typed params, empty/loading/error states handled for every screen.
  - Pass threshold: ≥ 3.

AC-14. **Security & Validation (0-3)**:
  - 0: userId accepted from frontend body, no ownership checks.
  - 1: userId from JWT in some but not all endpoints; missing ownership checks on detail routes.
  - 2: userId always from JWT, ownership checks on single-resource GET/PUT, basic validation.
  - 3: + compound DB indexes for uniqueness, guests vs table capacity enforced, time/date business rules validated.
  - Pass threshold: ≥ 2.
