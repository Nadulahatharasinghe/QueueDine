# QueueDine Customer ↔ Staff Connectivity Specification

## Problem

QueueDine currently has two functionally separate backend systems sharing a single MongoDB database but operating in complete isolation:

1. **Customer-facing system** (`/api/restaurants/*`, `/api/reservations/*`, `/api/queue/*`) uses collections `restaurants`, `tables`, `reservations`, `queueentries`.
2. **Staff-facing system** (`/api/staff/*`) uses completely separate collections `staff_restaurants`, `staff_tables`, `staff_parties`, `staff_accounts`, `staff_sessions`, `staff_events`, `staff_notifications`, `staff_alerts`.

The result is that **when a Customer creates a reservation via the mobile app using Reservation collection, Restaurant Staff never see it** because their dashboard only reads `StaffParty` collection. Conversely, reservations created by Staff never appear in the Customer's booking list. Restaurant information has a fragile name-based link but staff profile changes (address, hours, contact stored in `StaffRestaurant`) don't propagate to the `Restaurant` document shown to customers.

This spec implements the data bridge so the two systems share the SAME data source for:
- Restaurant information (Staff edits → Customer sees it)
- Reservations (Customer creates → Staff sees → Staff updates status → Customer sees)
- Queue entries (Customer joins → Staff sees → Staff status changes → Customer sees)
- Restaurant photos (Staff upload → GridFS → Customer view via existing endpoint)

No features (Login/Register, Profile, existing Reservation/Queue flows, Staff login, Staff party management) may be broken. All existing screens and endpoints must continue working as-is.

## Users

- **Authenticated Customer**: Logged-in mobile app user who browses restaurants, makes reservations, joins queues.
- **Authenticated Restaurant Staff**: Host/manager who logs into `/staff` portal, manages restaurant profile, manages walk-ins/reservations/queue, tables, and changes reservation statuses.
- **Restaurant Manager**: Configures the restaurant name/profile (can be a staff user with role=manager).

## Goals

1. **Restaurant Info Sync**: Staff-owned restaurant details (name, description, address/location, opening hours, cuisine, photo) stored in shared `Restaurant` model. When Staff changes these via profile or seed, Customer app retrieves latest values via `/api/restaurants` endpoints.
2. **Reservation Visibility Bidirectional**:
   - Customer creates via `/api/reservations` → saved in `Reservation` collection → **ALSO appears on Staff dashboard** under the correct restaurant.
   - Staff creates reservation via `/staff` → saved in `StaffParty` collection with kind=reservation → **ALSO appears in Customer's reservations list** if linked to a user, or at minimum visible to staff who need it.
3. **Status Synchronization**: When Staff marks reservation `arrived` / `seated` / `cancelled` / `no-show` via Staff actions, the corresponding `Reservation` record's status field (if any) reflects the change for Customer. When Customer modifies/cancels reservation via mobile, Staff see the update.
4. **Queue Entry Visibility**: When Customer joins queue via `/api/queue/join`, the queue entry **appears in Staff Queue dashboard** for the restaurant. When Staff sends alerts (table-ready/almost-ready) or marks as `seated`, the Customer's `QueueEntry` `status` reflects the change via polling.
5. **Staff Scope Enforcement**: Staff JWT guarantees `restaurantId` scoping. Backend queries filter by `authenticatedRestaurantId` on every staff endpoint. Cross-restaurant access returns 403/404 — never frontend-only.
6. **Consistent Identity**: Use `Restaurant._id` (ObjectId from `restaurants` collection) as the canonical restaurant reference everywhere. Remove or replace name-matching link in `resolveStaffRestaurant` with a direct ObjectId reference (`customerRestaurantId`) on `StaffRestaurant`. Reservation and QueueEntry already use this correctly.
7. **Remove Masking Fallbacks**: Customer screens (Home, Restaurant Details) currently fall back to hardcoded `Ember & Oak` / `4.6` / `~25 mins` / `12 in queue` / `8 tables available` when API result is absent. These are replaced with proper loading indicators + graceful error messages so API data loading failure is visible instead of masked by stale static values.
8. **No Breaking Changes**: All existing endpoints, data models, login flows, navigation screens, and buttons continue working. No UI redesign. No new dependencies unless absolutely required.
9. **Use Existing Notification System**: Reservation status changes and queue actions create entries via the existing Notification model (`/api/notifications`) for Customers, and via existing StaffNotification model (`/api/staff/notifications`) for Staff. Do NOT create a second notification system.

## Non-Goals

- No WebSockets / Socket.IO. Use existing polling mechanism (`useStaffResource` polls every 15s, Customer reservations screen has Pull-to-Refresh and `useFocusEffect` reload).
- No redesign of Staff UI or Customer UI components.
- No changes to login/auth flow (JWT audience for staff remains `queuedine-staff`, customer tokens use `JWT_SECRET` as before).
- No migration of historical reservation/queue data. New sync mechanism applies going forward; any existing old records can remain.
- No photo upload from Customer side (only Staff uploads to GridFS, which is already implemented).
- No multi-restaurant UI changes (single restaurant Ember & Oak as before).
- No changes to JWT structure for either staff or customer auth.
- No changes to existing seed scripts unless absolutely necessary for the relationship fix.
- No changes to reservation status enums in Reservation model: keep `pending | confirmed | cancelled | completed`.
- No changes to queue status enums in QueueEntry: keep `waiting | called | seated | cancelled`.

---

## Functional Requirements

### Backend

#### 1. StaffRestaurant ↔ Customer Restaurant Reference

**Current state (broken)**:
```typescript
// restaurantLink.ts
await Restaurant.findOne({ name: staffRestaurant.name })  // name match! fragile
```

**Required state**:
- Add `customerRestaurantId: mongoose.Types.ObjectId` field to `StaffRestaurant` schema (ref: `'Restaurant'`).
- `resolveStaffRestaurant` uses this field directly: `Restaurant.findById(staffRestaurant.customerRestaurantId)`.
- If the field is missing (legacy records), fall back to name match for ONE-TIME backfill and write the found ObjectId back into `customerRestaurantId`.
- Backend returns `400` / `503` when link cannot be resolved instead of silently failing.
- Staff `/me` and `/dashboard` endpoints include `customerRestaurantId` in the returned `restaurant` payload for the frontend's awareness.

#### 2. Staff Party List: Include Customer Reservations & Queue Entries

**Current state**:
- `GET /api/staff/parties?kind=reservation` → queries `StaffParty.find({ restaurantId, kind: 'reservation' })` only.
- `GET /api/staff/parties?kind=queue` → queries `StaffParty.find({ restaurantId, kind: 'queue' })` only.

**Required state**:
Both endpoints return a **merged** result combining:
- (A) Existing `StaffParty` records for the staff's restaurant (keep these — staff-originated entries, walk-ins, etc.)
- (B) `Reservation` records whose `restaurantId` matches the linked `customerRestaurantId`. These are converted to the `Party` schema shape on-the-fly:
  - `_id`: prefixed e.g. `"res_${reservation._id}"` so frontend can disambiguate
  - `number`: `"R-" + reservation._id.toString().slice(-6).toUpperCase()`
  - `kind`: `"reservation"`
  - `customerName`: from populated `User.fullName`; if User deleted fallback `"Customer"`
  - `mobileNumber`: from populated `User.phone`; fallback `"N/A"`
  - `partySize`: `reservation.guests`
  - `status`: map Reservation → StaffParty status:
    - `'pending'`   → `'upcoming'`
    - `'confirmed'` → `'upcoming'`
    - `'completed'` → `'seated'`
    - `'cancelled'` → `'cancelled'`
  - `bookingAt`: combine `reservation.date + "T" + reservation.time + ":00"` (interpreted as Sri Lanka timezone)
  - `tableId`: if reservation has tableId → translate to corresponding `StaffTable._id` (or keep as-is with prefix; use `_id` lookup)
  - `specialRequests`: `reservation.specialRequests || ''`
  - `createdAt`: `reservation.createdAt`
  - Include a synthetic field `_source = 'reservation'` to identify origin
- (C) `QueueEntry` records whose `restaurantId` matches the linked `customerRestaurantId` AND whose `status` is in an "active set" `{waiting, called, seated}` (no cancelled already-completed):
  - `_id`: `"que_${queueEntry._id}"`
  - `number`: `"Q-" + String(queueEntry.queueNumber).padStart(3, '0')`
  - `kind`: `"queue"`
  - `customerName`: populated User.fullName → fallback `"Customer"`
  - `mobileNumber`: populated User.phone → `"N/A"`
  - `partySize`: `queueEntry.guests`
  - `status`: map
    - `'waiting'` → `'waiting'`
    - `'called'`  → `'ready'`
    - `'seated'`  → `'seated'`
    - `'cancelled'` → `'cancelled'`
  - `createdAt`: `queueEntry.joinedAt`
  - `specialRequests`: `queueEntry.specialRequests || ''`
  - `_source = 'queue'`

**Staff Dashboard `/api/staff/dashboard`** also merges metrics:
- `waiting` count = `StaffParty(queue, active)` + `QueueEntry(waiting status)`
- `tables` = keep StaffTables as-is (they're the system of record for staff table management; no change needed).
- `next` party = earliest createdAt from the merged active set.

#### 3. Staff Actions on Customer-Originated Reservations/Queue Entries

**Current state**: `PATCH /api/staff/parties/:id` only knows how to patch `StaffParty` → Customer origin entries are unmanageable from staff side.

**Required state**: Detect synthetic `_id` prefixes (`res_` / `que_`) in `PATCH /api/staff/parties/:id` and route to the appropriate update:

**For reservations (`res_` prefix)**:
| Staff action | → Reservation change | → Customer Notification |
|---|---|---|
| `arrived` | (No native Reservation status = arrived; keep status = confirmed, record event via StaffEvent) | Optional `reservation_modified` type "Your party has been marked as arrived" |
| `cancel`  | status → `cancelled`, `cancelledAt = now()` | `reservation_cancelled` notification to userId |
| `edit`    | Update `guests`, `specialRequests`; if booking time changes update `date`/`time`. Re-run conflict checks. | `reservation_modified` notification |
| `no-show` | status → `cancelled` (no "no-show" enum in Reservation). Create StaffEvent. | `reservation_cancelled` with message "marked no-show" |
| **Seat via assign** | After staff assigns table → StaffParty has `seated` status → Reservation status `completed` (or keep confirmed; treat "completed" value as "served". Use `completed` when actually finished dining as now). Prefer "confirmed" while dining; mark `completed` only via explicit action or later. Default: Reservation → status remains `confirmed` when table is assigned by Staff; add a reserved tableId sync. The only map to `completed` is via a separate "Mark Complete" action if/when staff provides it later. For this spec: keep status = confirmed while assigned; no change to completed. (Avoids premature status flip for customer.) | status sync notification on actual change only |

**For queue entries (`que_` prefix)**:
| Staff action | → QueueEntry change | → Customer Notification |
|---|---|---|
| `cancel` | status → `cancelled`, `cancelledAt=now()` | `queue_cancelled` |
| **Send alert `almost-ready` stage** | No QueueEntry status change, just record StaffAlert. Optionally add `reservation_modified`-like notification to customer. | `queue_status_changed` "Your table will be ready shortly." |
| **Send alert `ready` stage** | status → `called`, `calledAt=now()` | `queue_next` "Your table is ready!" |
| **Seat via assign** | status → `seated`, `seatedAt=now()`, recalc positions | `queue_status_changed` "You have been seated!" |
| `edit` | Update guests/specialRequests. Re-run queue position recalc after party size edit → no, position unaffected by party size. Just update fields. | optional modified notification if guest count changes. |

**Staff Assign Table** (`POST /api/staff/assign`): When `partyId` starts with `res_` or `que_`, translate the action appropriately:
- `que_` → find QueueEntry, set status to seated + update StaffTable
- `res_` → find Reservation. Mode=hold: just log event (Reservation model has no hold concept native). Mode=seat: set Reservation status if we decide status to reflect seating (stays confirmed per above rule).

Note: Because StaffTable and Table (customer) are separate collections, assign works on StaffTable only; we just record the event against Reservation as a note for future — no need to update customer Table model.

#### 4. Customer Reservation/Queue: Create → Notify Staff

**Current state**: Customer creates a Reservation or joins Queue → only `Reservation`/`QueueEntry` collections written, no Staff side notified.

**Required state**: On success in:
- `reservationController.createReservation()` → create a **StaffNotification** record (in addition to the existing customer Notification):
  ```
  restaurantId: staffRestaurant._id  // linked customerRestaurantId → StaffRestaurant
  message: `New online reservation: ${formattedDate} at ${formattedTime} for ${guests} by ${userName}`
  category: 'Reservations'
  ```
- `queueController.joinQueue()` → create a StaffNotification:
  ```
  restaurantId: staffRestaurant._id
  message: `Customer joined queue: Q-${queueNumber.padStart(3)} (${guests} guests)`
  category: 'Queue'
  ```

#### 5. Staff Restaurant Profile → Shared Restaurant Model

**Current state**: `/api/staff/restaurant-photo` writes to `Restaurant` (via resolveStaffRestaurant) — good. But StaffRestaurant has its own `name`, `location`, `timeZone` fields which duplicate and may drift from `Restaurant.name/location`. No endpoint exists for Staff to edit restaurant name/description/hours/cuisine from the staff portal profile.

**Required state**:
- Add `GET /api/staff/restaurant` → returns the SHARED `Restaurant` model document (via resolveStaffRestaurant) so Staff profile screen can load it.
- Add `PUT /api/staff/restaurant` → Staff can update: `name`, `description`, `location`, `openingHours {open, close}`, `cuisine`. Validate fields (not empty, hours strings). Write changes **ONLY to the shared `Restaurant` model** (this is the single source of truth shown to Customers). Optionally, denormalize the name change into `StaffRestaurant.name` as well to keep legacy name-matching fallback working (backwards compat).
- Do NOT allow the Staff to change `rating`, `reviewCount` (those are review-system fields).
- On success, updated values are immediately visible via GET `/api/restaurants/:id` and GET `/api/restaurants` endpoints.
- Existing `/api/staff/restaurant-photo` (GET/PUT/DELETE) stays as-is; already correct.

#### 6. Reservation Status Bidirectional Sync (Customer → Staff)

**Current state**: Customer cancels/modifies reservation → `Reservation` updated in place; Staff dashboard doesn't see the change unless staff manually refreshes AND even then, it only shows StaffParty (so customer-origin records + their status updates are simply not visible).

Because requirement #2 already merges Reservations into the staff /parties list with live mapping of status, customer-side modifications are automatically visible on next poll. Additionally:
- On `cancelReservation` and `modifyReservation`, also create a StaffNotification record.
- No additional work for Staff-side beyond the merge because it reads at-query-time.

#### 7. Customer Reservations List → Include Restaurant Photo & Full Details

**Current state**: `GET /api/reservations` populates `restaurantId, name, location`. No photo URL. Customer reservation list card just shows text Restaurant name, no image.

**Required state**: Backend `getMyReservations` and `getReservationById` include `photoFileId` in the populate so the frontend can render images. Use an explicit select: populate with `name, location, photoFileId, imageUrl`. The controller already returns the restaurant doc object; the populate fields can just include those.

Customer mobile `reservations.tsx` card:
- Add a small restaurant photo thumbnail using the existing `photoUri()` helper on `restaurantId.imageUrl` (or construct `/api/restaurants/{_id}/photo` if imageUrl not computed at list time).
- Fallback to placeholder if no photo available.

#### 8. Restaurant Identity — No Name-Based Joins Anywhere Critical

Audit entire backend to confirm:
- Reservation `restaurantId` → ref: Restaurant._id (ObjectId) ✓ already correct
- QueueEntry `restaurantId` → ref: Restaurant._id ✓ correct
- Table `restaurantId` → ref: Restaurant._id ✓ correct
- Staff account → restaurantId string → StaffRestaurant._id (UUID string)
  This is fine; the bridge is StaffRestaurant.customerRestaurantId (ObjectId) → Restaurant._id.
- No "WHERE name = X" in Reservation, QueueEntry, Table, Notification queries. ✓ (only in resolveStaffRestaurant legacy fallback).

#### 9. Security & Ownership (Backend Enforcement, Not Frontend)

- Staff `/parties/:id` PATCH: If a synthetic `res_xxx` or `que_xxx` entry's resolved underlying restaurantId doesn't match the staff's restaurant, return **403 Forbidden**.
- Staff `/assign`, `/alerts`, etc.: same scoping.
- Customer `GET /api/reservations/:id` already has ownership check: `reservation.userId === req.user.userId`. Keep it.
- Customer queue status / cancel: already owner-enforced. Keep.
- Error handling:
  - `GET /api/restaurants/:nonexistent-id` → 404 `{ error: 'Restaurant not found' }` (already done)
  - `POST /api/reservations` with invalid restaurantId → 404 Restaurant not found (already done)
  - Staff attempts to access another restaurant's party → 403
  - Invalid token (either staff or customer) → 401 via existing middleware
  - DB connection failure → 500 without leaking raw mongo errors to the client response body (use catch-all with generic "Unable to complete action" in routes, console.error the detail).

---

### Frontend (Customer Mobile App)

#### 10. Remove Hardcoded Fallbacks; Use Loading + Error States

Files: `mobile/app/home.tsx`, `mobile/app/restaurant.tsx`

Current masking fallbacks:
```tsx
// home.tsx L110
{restaurant?.name || 'Ember & Oak'}   // ← remove || hardcoded
// home.tsx L112 rating fallback 4.6, review 1.2k, location fallback
// home.tsx stats ~25 min wait, 12 in queue, 8 tables available
```

Required behavior:
- While `loading` or `restaurant === null`: show skeleton/text like "Loading restaurant…" (use existing ActivityIndicator pattern).
- If restaurant fetch fails: show `'Failed to load restaurant. Pull to refresh.'` red text error placeholder (no fake static values shown).
- `restaurant.tsx`: same treatment for currentWaitTime / queueLength / availableTables fallbacks (`restaurant.currentWaitTime || 25` → show `loading...` or N/A text until API loads).
- Keep the image fallback image (welcome_page_background_image.png) for the case when no photo is uploaded (that's a legitimate empty-state, not a data-mask).

#### 11. Customer Reservation List — Restaurant Photo

Already part of backend #7 above. Frontend:
- In `mobile/app/reservations.tsx`, within each card, render a 60×60 thumbnail next to restaurant name using `photoUri(restaurant?.imageUrl)` or construct `/api/restaurants/${restaurantId._id}/photo` if needed.
- No change to the reservation flow screens.

#### 12. Customer Reservation Details — Status Polling / Refresh on Focus

- `reservation/[id].tsx` (create if missing, already exists per prior tasks): Ensure `useFocusEffect` triggers refresh so status changes made by Staff are visible within 15 seconds. Also add pull-to-refresh if ScrollView is used.
- Customer Notifications badge (home + notifications page): Existing system refreshes on focus; keep.

#### 13. Customer App — No Hardcoded Restaurant Arrays / JSON Anywhere

Grep full `mobile/` for patterns:
- `Ember & Oak` literal outside of copy text → replace if used as data. Screen copy like "Thank you for dining with us at Ember & Oak" can remain as static marketing copy only, never as source of restaurant's display name.
- Hardcoded image asset require() for restaurant → replaced by dynamic photoUri.
- Hardcoded opening hour strings → from API `openingHours`.
- Address "Colombo, Sri Lanka" literal → from API `location` field.

---

### Frontend (Staff Portal)

#### 14. Profile Screen — Edit Restaurant Details

Current staff profile screen only lets users edit their own name/duty status + upload photo.

Required additions:
- Add editable fields at bottom of profile screen for:
  - Restaurant name
  - Description (multiline)
  - Location/address
  - Cuisine
  - Opening Hours (open + close as HH:MM)
- Save button → `PUT /api/staff/restaurant`.
- On success: toast "Restaurant details saved."; refresh dashboard / profile state.
- Keep existing photo upload + remove controls; they already work.

#### 15. Staff Screen: Handle Mixed-Origin Party Rows Gracefully

Current `PartyRow` in `StaffScreens.tsx`:
```tsx
<Pressable onPress={() => go('party', { id: party._id })}>
```
The synthetic IDs `res_xxx` / `que_xxx` are just strings; frontend passes them through. The Party details screen (`/staff/party?id=`) calls `useStaffResource('parties/:id')` → backend must support GET for the synthetic id (map `res_xxx` → Reservation.findById, `que_xxx` → QueueEntry.findById, else StaffParty.findById + cross-restaurant 403).

Staff party row rendering should already handle the merged data because field names (`customerName`, `number`, `partySize`, `kind`, `status`, `bookingAt`) are the same shape we return. No UI component changes required.

#### 16. Refresh Mechanism — Reuse Existing Polling Interval

Staff useStaffResource already:
```ts
setInterval(() => reload(), 15000)  // poll every 15s
```

Customer:
- Reservations list: `useFocusEffect` triggers reload (already done) + pull-to-refresh.
- Queue tracking screen: polls status every 10s.
- Restaurant details + home: reload on focus.

This satisfies requirement "do not implement WebSockets."

---

## Non-Functional Requirements

1. **Idempotency**: Status changes must not error when applied twice with same intent. E.g. if staff clicks "cancel" twice on the same reservation, second call returns 409 or 200 with existing state — no crash, no duplicate events/rows.
2. **Error messaging**: HTTP responses have `{ error: 'Human-readable message' }` shape matching existing style. Never send stack traces.
3. **Latency**: `/parties` query returning merged set must not exceed ~1s for typical volumes (< 500 active entries). Index appropriately: `Reservation { restaurantId, date, status }` already exists; QueueEntry `{ restaurantId, status }` already exists.
4. **No schema breaking**: Additive changes only to models.
   - StaffRestaurant: Add `customerRestaurantId?` (nullable, with fallback for missing).
   - No field renames or enum expansions for Reservation/QueueEntry.
5. **Type Safety**: TypeScript `strict` clean on backend and mobile via `npx tsc --noEmit`.
6. **No New Dependencies**: Express, mongoose, bcrypt, jsonwebtoken already present. Do not `npm install` anything unless unavoidable.
7. **Reservation Model**: Keep statuses `pending | confirmed | cancelled | completed`. When Staff "completes" a reservation later via any new action, use `completed`; but this spec doesn't require Staff Completion action beyond Cancel/No-show.

---

## Constraints, Dependencies, Assumptions

### Constraints
- **MongoDB collections**: Cannot drop/recreate existing collections. Migration scripts are additive-only.
- **JWT**: Keep dual-token system (customer tokens vs staff tokens with `aud: queuedine-staff`). They already authenticate correctly on their route groups.
- **No UI redesign**: Screen layout, colors, components all remain identical. If adding editable restaurant profile fields, they fit into the existing profile screen's scroll view.
- **Single restaurant**: Ember & Oak with seeded id `ember-oak` for staff and corresponding ObjectId seeded Restaurant doc for customer.

### Dependencies
- Backend: `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `multer`, `gridfs-stream`, `cors`, `dotenv` — all installed.
- Mobile: `expo-router`, `axios`, `@react-native-async-storage/async-storage`, `expo-image-picker` — all present per existing package.json + verified in Staff profile code.
- GridFS photo storage: already implemented via `restaurant_photos.files` + `restaurant_photos.chunks` with `photoFileId`.

### Assumptions
1. Timezone: restaurant operates in `Asia/Colombo` (UTC+5:30). `bookingAt` synthetic conversion from Reservation date/time strings uses this offset.
2. Reservation times in `Reservation.time` are already stored as `"18:00"` in restaurant local time (per existing check-availability logic). We treat them as such when synthesizing `bookingAt` Date object.
3. Staff's dashboard will continue showing its own `StaffTables` as before; customer Table model isn't synced one-to-one (staff tables may have capacities 2,4,4,4,4,6,6,8,10, plus StaffTables T01–T12). They can be out of sync; customer reservation assignment uses customer Tables only.
4. The "Modify Reservation" / "Cancel Reservation" buttons on customer side already work (from previous spec work). We just need to propagate the result of these actions into StaffNotifications for staff's awareness.

### Open Questions (Resolved by Assumption)
1. **Do we physically duplicate Customer Reservation into StaffParty collection, or query-at-display time?** → Assumption: **Query-at-display time** (merge on GET) for now. This keeps the source-of-truth single and avoids race-condition sync bugs. Disadvantage: some staff features like per-party table assignment for customer-origin reservations need the prefix-based routing implemented (Req #3). We implement prefix routing.
2. **Should customer-originated reservations/queue entries that staff acts on also create StaffParty records for deeper audit/activity?** → For now, create only StaffNotification and StaffEvent records (both already support the fields) when staff acts on a synthetic party; don't mirror to StaffParty unless strictly needed for assign/alerts routes that can create them.
3. **What about walk-ins created by staff? They have no userId. Should they appear in customer reservation lists?** → No, walk-ins are staff-only and lack userId; they show in staff dashboard but not customer booking list. Correct behavior already (only Reservations with userId populate into customer lists).

---

## Acceptance Criteria

### rule

AC-1. **Staff can see customer-originated reservations.** After Customer POST `/api/reservations` creates a record, a Staff GET `/api/staff/parties?kind=reservation` against the same restaurant returns an entry with `_id` prefixed `res_` whose `customerName`, `partySize`, `bookingAt`, `number` match the Reservation data.

AC-2. **Staff can see customer-originated queue entries.** After Customer POST `/api/queue/join` creates a QueueEntry, Staff GET `/api/staff/parties?kind=queue` returns a `que_`-prefixed entry with correct Q-number, party size, waiting status.

AC-3. **Staff scoping prevents cross-restaurant access.** Create Reservation for restaurant A. Use a valid staff JWT for a DIFFERENT StaffRestaurant (one whose customerRestaurantId does not match the Reservation's restaurantId). The reservation is not visible in `/parties` list. Direct PATCH `/parties/res_<id>` returns HTTP 403 Forbidden (not found OR explicitly forbidden, but definitely not modified).

AC-4. **Status update round trip works for reservations.** Customer creates confirmed Reservation. Staff PATCH `/parties/res_<id>` with `{ action: 'cancel' }` → Reservation.status is now `'cancelled'` + `cancelledAt` set; Customer notifications collection has a `reservation_cancelled` notification for the user.

AC-5. **Status update round trip works for queue.** Customer joins queue → queued. Staff sends alert stage=`ready` via synthetic id `que_<id>` → QueueEntry.status = `'called'` and `calledAt` set; Customer notification `queue_next` created.

AC-6. **Restaurant profile edits propagate to customer.** Staff PUT `/api/staff/restaurant` with new `{ name, description, location, openingHours: {open: '12:00', close: '22:00'}, cuisine: 'Sri Lankan' }`. After save, GET `/api/restaurants/:id` (public) returns these updated values. Staff dashboard `/me` returns customerRestaurantId matching the Restaurant._id.

AC-7. **resolveStaffRestaurant uses ObjectId link.** After the StaffRestaurant document gets `customerRestaurantId` populated (either by migration script or by first-run name-match backfill), subsequent `resolveStaffRestaurant` calls use `findById` on that ObjectId. No name-based matching occurs after the backfill (fallback name-match only used once to set the field, then never again).

AC-8. **Customer Home & Restaurant Details show no hardcoded data.** Disconnect backend (stop the server). Open mobile app. Home page shows LOADING indicator and/or error text like "Failed to load restaurant". It does NOT show "Ember & Oak", rating "4.6", wait "~25 mins" as static values when API data is unavailable. Reconnect backend → data appears.

AC-9. **Customer's reservations list includes photo & correct restaurant ref.** GET `/api/reservations` response for each entry has `restaurantId: { _id, name, location, photoFileId }`. Frontend reservation card renders restaurant thumbnail using the photo endpoint. Restaurant name comes from populated ref, not hardcoded.

AC-10. **Customer-side reservation cancellation → Staff sees StaffNotification.** Customer PUT `/api/reservations/:id/cancel` succeeds. Staff GET `/api/staff/notifications` contains a new Reservations-category notification referencing the cancellation.

AC-11. **Customer-side queue cancellation → Staff sees update.** Customer leaves queue → queue entry status `cancelled`. Staff next /parties?kind=queue poll no longer shows it in active list (since active set excludes cancelled). Staff Notification queue-category event generated.

AC-12. **Existing staff-originated entries continue working.** Create a reservation via staff `POST /api/staff/parties` kind=reservation. It appears in staff parties list alongside customer-origin entries. Status transitions (upcoming → arrived → seat via assign) work unchanged. Walk-in queue add still works.

AC-13. **Photo integration end-to-end.** Staff upload photo → StaffRestaurant's linked Restaurant.photoFileId set. Customer open restaurant details → hero image displayed with `GET /api/restaurants/:id/photo` (status 200, correct Content-Type). Home restaurant card shows the same photo.

AC-14. **TypeScript clean on both repos.** `backend/` directory `npx tsc --noEmit` exit 0. `mobile/` directory `npx tsc --noEmit` exit 0.

AC-15. **Error messages correct.** Non-existent restaurant ID on customer API, non-owner access to reservation, invalid staff JWT for cross-restaurant access, malformed PUT body for restaurant profile all return non-2xx HTTP codes with structured error messages.

AC-16. **Login flows intact.** Customer register/login still returns JWT + user profile. Staff `/api/staff/auth/login` returns JWT with audience queuedine-staff and populates user + restaurant. No 401 on valid credentials; no 200 on invalid credentials.

### rubric

AC-17. **Architecture Purity — Single Source of Truth (0-5):**
  - 0-1: Reservation/Queue data is still duplicated into StaffParty; divergence risk.
  - 2: Data merged at query time but with inconsistent/incorrect status mappings that fall out of sync.
  - 3: Merged at query time cleanly. All status changes routed to the correct model. Correctly identifies synthetic prefixes.
  - 4-5: Plus notifications & events created on BOTH sides for every significant action. Clean separation of Party DTO (merged view) vs source-of-truth models. No name-matching on hot paths.
  - Pass threshold: ≥ 3.

AC-18. **Code Consistency with Existing Patterns (0-5):**
  - 0-1: Ad-hoc controller logic, inconsistent error handling, new patterns not matching existing code.
  - 2-3: Works but with duplication; some catch blocks leak stack traces. Some files have new auth/validation logic unlike existing.
  - 4-5: All changes follow existing `controller -> route` pattern. Auth middleware uses `req.user` / `account(res)` helpers as before. Prefix-detection for synthetic IDs is isolated to ONE router utility function. New endpoints are mounted cleanly in `staffRoutes`.
  - Pass threshold: ≥ 3.

AC-19. **Graceful Degradation & User Feedback (0-3):**
  - 0: Network failures / offline show either stale fake data OR blank white screen.
  - 1: Errors shown but with tech jargon. Loading states missing on some screens.
  - 2: Loading indicators + red error text everywhere, with actionable messages. Small amount of fake fallback for a critical 1-2 values only, clearly labeled.
  - 3: Zero fake static data used as stand-in for missing API. All loading/error states handled with explicit copy; photo placeholder only for "no photo uploaded" (empty state), not "API failed".
  - Pass threshold: ≥ 2.
