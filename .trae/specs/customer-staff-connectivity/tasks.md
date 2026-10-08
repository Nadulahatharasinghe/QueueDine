# QueueDine Customer ↔ Staff Connectivity Implementation Tasks

Derived from spec.md `customer-staff-connectivity/spec.md`. Each AC maps to tasks.

Implementation priority order for 8 tasks: backend model fixes → shared controller utilities → staff routes merging → status sync → restaurant profile edit → notifications sync → frontend hardcoded-fallback removal → type checks & integration testing.

---

## Task 1: StaffRestaurant Model Link + Backfill resolveStaffRestaurant

**Status**: pending
**Priority**: high
**Depends on**: none

### Description

Add `customerRestaurantId` (ObjectId) field to StaffRestaurant schema. Update `resolveStaffRestaurant` to use it, with a one-time name-match backfill when field is null. Update `/api/staff/me` and `/api/staff/dashboard` to include `customerRestaurantId` in the returned restaurant object so frontend code can trust the canonical ID. Update seed script `backend/src/staff/seed.ts` to write `customerRestaurantId` (find the "Ember & Oak" Restaurant objectId and embed it into StaffRestaurant doc being seeded).

### Files to modify

- `backend/src/staff/models.ts` — add field to StaffRestaurant schema:
  ```
  customerRestaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', default: null, index: true }
  ```
- `backend/src/utils/restaurantLink.ts` — rewrite `resolveStaffRestaurant`:
  1. Read `account.restaurantId → StaffRestaurant.findById`
  2. If `staffRestaurant.customerRestaurantId !== null` → `Restaurant.findById(staffRestaurant.customerRestaurantId)` → return pair
  3. Else → legacy name-match fallback. If found:
     - write `staffRestaurant.customerRestaurantId = foundRestaurant._id` → save
     - log `[restaurantLink] backfilled customerRestaurantId for ${staffRestaurant._id}`
     - return pair
  4. If not found → existing `StaffError(503, "Customer listing not configured…")`
- `backend/src/staff/routes.ts` — `GET /me` include `customerRestaurantId: customerRestaurant._id` in the restaurant object; `/dashboard` similarly append to restaurant payload.
- `backend/src/staff/seed.ts` — before creating/upserting StaffRestaurant, `Restaurant.findOne({ name: 'Ember & Oak' })` then set `customerRestaurantId` on the upserted doc.
- Also add a helper export `restaurantLink.ts → getCustomerRestaurantIdForStaff(account)` that returns the ObjectId (or throws) for reuse in later tasks.

### Test Requirements

#### rule
TR-1.1. Starting with existing MongoDB where StaffRestaurant has NO `customerRestaurantId` field, call `resolveStaffRestaurant` (via `/api/staff/me`). After the HTTP response returns, re-read StaffRestaurant document from db; confirm `customerRestaurantId` now equals the Restaurant doc _id for "Ember & Oak". Second call does NOT hit the name-match branch (can verify via logs or second call being fast). TR-1.2. New staff login flow returns `restaurant.customerRestaurantId` as a 24-char hex string.
TR-1.3. Running `backend/src/staff/seed.ts` on fresh DB inserts a StaffRestaurant with `customerRestaurantId` already set to the Ember & Oak ObjectId.
TR-1.4. `tsc --noEmit` passes.

Evidence: `curl -H "Authorization: Bearer $STAFF_TOKEN" http://localhost:5000/api/staff/me | jq '.restaurant.customerRestaurantId'` prints the correct ObjectId.

### Maps to ACs: AC-6, AC-7, AC-16, AC-15

---

## Task 2: Shared Staff Controller Utils — Synthetic ID Routing

**Status**: pending
**Priority**: high
**Depends on**: Task 1

### Description

Create a small utility module `backend/src/staff/syncUtils.ts` (or `backend/src/utils/staffSync.ts`) that:
- `isSyntheticId(id) → { kind: 'reservation' | 'queue' | null, rawId: string }`
  - `res_xxx` → return `{ kind: 'reservation', rawId: xxx }`
  - `que_xxx` → return `{ kind: 'queue', rawId: xxx }`
  - else → `null`
- `mapReservationStatusToStaff(status: ReservationStatus): string`
  - `pending → upcoming`, `confirmed → upcoming`, `completed → seated`, `cancelled → cancelled`
- `mapQueueStatusToStaff(status: QueueStatus): string`
  - `waiting → waiting`, `called → ready`, `seated → seated`, `cancelled → cancelled`
- `reservationToPartyDTO(reservationDoc: WithUserPopulated, tablesMap?) → PartyShape`
  - _id: `res_${_id}`, number: `R-${slice-6}`, kind: reservation, customerName: user.fullName, mobileNumber: user.phone || 'N/A', partySize: guests, status: mapped, bookingAt: combine date+time+05:30 tz → ISO Date, specialRequests, createdAt, _source: 'reservation', tableId etc.
- `queueEntryToPartyDTO(entry: WithUserPopulated) → PartyShape`
  - _id: `que_${_id}`, number: `Q-${pad queueNumber}`, kind: queue, customerName: user.fullName, mobileNumber: user.phone || 'N/A', partySize: guests, status: mapped, createdAt: joinedAt, specialRequests, _source: 'queue'
- `scopedReservationsCursor(account, opts?)` — builds Reservation mongoose query: `{ restaurantId: getCustomerRestaurantIdForStaff(account), ...opts }` — this is the backend security boundary (ensures scoped to staff restaurant).
- `scopedQueueCursor(account, opts?)` — similar for QueueEntry.
- `findResoUnderStaff(account, syntheticOrRealId)` — resolves synthetic id → Reservation doc; or rejects with 403 if doc's restaurantId doesn't match staff's customerRestaurantId.
- `findQueueUnderStaff(account, syntheticOrRealId)` — same for QueueEntry.

### Files to create/modify

- Create `backend/src/utils/staffSync.ts` with above functions (use named exports).
- Ensure it imports from existing models: Reservation, QueueEntry, User, StaffRestaurant, etc.

### Test Requirements

#### rule
TR-2.1. `isSyntheticId('res_abc123')` returns `{ kind:'reservation', rawId:'abc123' }`; `isSyntheticId('que_xyz')` returns queue; `isSyntheticId('T-12345-abcdef')` returns null.
TR-2.2. `mapReservationStatusToStaff('confirmed') → 'upcoming'`; `mapReservationStatusToStaff('cancelled') → 'cancelled'`; `mapReservationStatusToStaff('completed') → 'seated'`.
TR-2.3. `mapQueueStatusToStaff('waiting') → 'waiting'`; `mapQueueStatusToStaff('called') → 'ready'`; `mapQueueStatusToStaff('seated') → 'seated'`.
TR-2.4. Given a valid Reservation with populated User, `reservationToPartyDTO` returns `_id` prefixed with `res_` and correct `bookingAt` ISO date whose wall-clock time matches `date + time` in Asia/Colombo (verify e.g. date=2025-04-25 time=19:00 → bookingAt.toISOString ends with `13:30:00.000Z` → i.e. 19:00+05:30 = 13:30 UTC).
TR-2.5. TypeScript compiles clean.

### Maps to ACs: AC-1, AC-2, AC-4, AC-5, AC-17, AC-18

---

## Task 3: Merge Customer Reservations + Queue Entries into Staff `/parties` + `/dashboard`

**Status**: pending
**Priority**: high
**Depends on**: Tasks 1, 2

### Description

Modify the staff routes so:
- `GET /parties?kind=reservation` returns merged list:
  1. StaffParty.find(restaurantId, kind=reservation) → limit(500) existing array.
  2. Reservation.find({ restaurantId: customerRestaurantId }) — date-sorted descending, recent 500 — then populate userId (fullName, phone), populate restaurantId, tableId → convert each via `reservationToPartyDTO`.
  3. Concatenate arrays, dedupe by _id (there shouldn't be overlaps; prefixes differ), sort by `bookingAt || createdAt` descending (or reservation-specific sort: upcoming first). Return combined.
- `GET /parties?kind=queue` merged:
  1. StaffParty(kind=queue) limit 500.
  2. QueueEntry.find({ restaurantId: customerRestaurantId, status: { $in: ['waiting','called','seated'] } }) — populate userId → convert via `queueEntryToPartyDTO`.
  3. Concat + dedupe by _id; sort by joinedAt/createdAt ascending (earliest = first in line).
- `GET /parties/:id` handle synthetic IDs:
  - if `isSyntheticId(id)` is reservation → `findResoUnderStaff` then return DTO.
  - if synthetic is queue → `findQueueUnderStaff` then return DTO.
  - else → `StaffParty.findOne({ _id: id, restaurantId: account.restaurantId })` existing logic.
- Dashboard `/api/staff/dashboard` merged metrics:
  - `waiting`: StaffParty count(queue, active) + QueueEntry count({status: waiting})
  - `next`: find the earliest in the merged queue active set (or null)
  - `tables`: unchanged (use StaffTable)
  - `restaurant`: append `customerRestaurantId` as before.
  - `unread`: unchanged.
  - `estimate`: use `waitEstimate(waiting, available)` as existing; no change to formula.

### Files to modify

- `backend/src/staff/routes.ts` — wrap handlers for `/parties`, `/parties/:id`, `/dashboard` with merged queries. The wrap helper used in routes.ts delegates to async functions; add new functions inside routes.ts (or extract to staff/controllers.ts if better, but keep in routes.ts for now for minimal new files).

### Test Requirements

#### rule
TR-3.1. No data in DB. Start server. Create customer user; log in customer. Create one reservation for Ember & Oak with restaurantId = seeded ObjectId. Response 201. Now call staff `GET /parties?kind=reservation` using valid staff JWT. Response array length ≥ 1; contains an entry whose _id starts with `res_` and customerName matches the customer's fullName; bookingAt ISO string matches the reservation date + time (Colombo tz).
TR-3.2. Same: Customer joins queue → QueueEntry created. Staff `GET /parties?kind=queue` returns a `que_` entry with correct Q-padded number and party size.
TR-3.3. Staff `GET /parties/res_<id>` returns 200 with merged DTO. Staff `GET /parties/que_<id>` returns 200.
TR-3.4. **Security scoping check**: Create a 2nd Restaurant "Test B" in DB directly. Create a Reservation for Restaurant=TestB (different ObjectId). Use staff JWT for Ember & Oak (customerRestaurantId=Ember&Oak). Call `/parties?kind=reservation` → the TestB reservation MUST NOT appear (length and _ids confirm).
TR-3.5. Dashboard returns waiting = sum(StaffParty active queue + QueueEntry waiting) when both exist.

### Maps to ACs: AC-1, AC-2, AC-3, AC-12, AC-17

---

## Task 4: Staff Actions on Synthetic Ids (PATCH party, assign, alerts) + Status Sync to Customer Models + Notifications.

**Status**: pending
**Priority**: high
**Depends on**: Tasks 2, 3

### Description

Add prefix-routing to the mutating staff endpoints so actions on customer-origin entries modify the source-of-truth models correctly.

**(a) PATCH `/parties/:id` with synthetic id**

Detect prefix inside the handler:
- `res_` id:
  - `action === 'cancel'` → set Reservation.status = cancelled, cancelledAt = now(). Then:
    i) create `StaffNotification` for restaurant + `StaffEvent` audit entry.
    ii) create customer-side `Notification` for user of type `reservation_cancelled` via existing `createNotification` in notificationController.
  - `action === 'no-show'` → Reservation.status = cancelled, cancelledAt = now(). Notification message mentions "no-show". Same audit trail.
  - `action === 'arrived'` → keep Reservation status = confirmed (no 'arrived' status in customer enum; just event + optional modified notification). Create StaffEvent + StaffNotification.
  - `action === 'edit'` → handle body { customerName, mobileNumber, partySize, bookingAt, specialRequests } → map partySize→guests, bookingAt→date+time, update Reservation. Re-validate capacity against table. Special requests → update. (Note: customerName/mobileNumber cannot be saved into Reservation model directly — ignore those or just log them; the User model owns them. We only accept partySize/bookingAt/specialRequests for Reservation edits via staff.) Re-run conflict check on update. Then notify user.
  - `action === 'extend'` → no-op for Reservations (no hold concept); return 200 with a note.
- `que_` id:
  - `action === 'cancel'` → QueueEntry.status = cancelled, cancelledAt=now(). Recalculate positions via existing `recalculatePositions`. Notify user `queue_cancelled`.
  - `action === 'edit'` → update guests, specialRequests on QueueEntry. Notify.
  - `action === 'arrived'` / `'extend'` → no matching semantics for queue; return 400 "Action not available for queue".

In each case, after the model update, also write a StaffNotification & StaffEvent record matching what existing StaffParty path does (see `record()` helper in routes.ts — refactor `record()` to accept strings and create both).

**(b) POST `/assign` synthetic partyId**

If partyId starts with `que_` or `res_`:
- Mode seat:
  - `que_` → set QueueEntry.status = seated, seatedAt=now(); recalc positions; notify user.
  - `res_` → set Reservation.status = completed (or confirmed depending on earlier rule; per spec we keep confirmed; mark an event only. For now: leave status = confirmed, record StaffEvent, StaffNotification).
- Mode hold:
  - `res_` → Reservation has no hold concept native; just create a StaffEvent noting "hold requested" and return success, but no update to Reservation status.

Then proceed with the StaffTable status update (reserved vs occupied) and StaffEvent/StaffNotification as existing code does.

**(c) POST `/alerts` synthetic partyId**

- `que_` with stage=ready → QueueEntry.status = called, calledAt = now(). Notify user: `queue_next` ("Your table is ready!").
- `que_` with stage=almost-ready → no QueueEntry status change; customer notify `queue_status_changed` type message "table almost ready".
- `res_` with any stage → customer notify `reservation_modified` type "table almost ready" or "table ready" message. No Reservation status change.

Create StaffEvent + StaffNotification via record() as usual.

### Files to modify

- `backend/src/staff/routes.ts`. This is the central file. Add prefix routing inside each handler.
- Refactor `record()` to be exported OR create a sibling helper `recordAudit(account, message, category, session, partyId?, tableId?)` that creates StaffEvent + StaffNotification records under a session like before. Import/use `createNotification` from `notificationController.ts` for customer-side notifications.
- Also, in `reservationController.ts` and `queueController.ts` (customer side): after successful `cancelReservation`, `modifyReservation`, `cancelQueue` — create a **StaffNotification** entry for the restaurant using the linked customerRestaurantId → StaffRestaurant (via a reverse lookup helper added to staffSync like `findStaffRestaurantByCustomerId(customerRestaurantId)`).

### Test Requirements

#### rule
TR-4.1. Customer creates confirmed reservation. Staff `PATCH /parties/res_<id>` with `{ action: 'cancel' }`:
  - Reservation.status === 'cancelled' in DB; cancelledAt is set.
  - Customer Notification collection has `{ type: 'reservation_cancelled', userId: <customerId>, relatedId: <reservationId>, relatedType: 'reservation' }`.
  - StaffNotification for restaurant exists.
TR-4.2. Customer joins queue (status=waiting). Staff sends `stage=ready` alert on the que_ synthetic id:
  - QueueEntry.status = `'called'`; calledAt set.
  - Customer Notification has `{ type: 'queue_next' }`.
TR-4.3. Staff assign `que_` id with mode=seat:
  - QueueEntry.status = `'seated'`; seatedAt set; queue positions recalculated.
  - Customer Notification type `queue_status_changed` with message "You have been seated".
TR-4.4. Staff attempts PATCH synthetic id of Reservation whose restaurant is NOT staff's own → 403 forbidden (or 404 if not found), DB unchanged.
TR-4.5. Customer cancels reservation → StaffNotification appears in GET `/api/staff/notifications` response.
TR-4.6. Customer joins queue → StaffNotification of category Queue "Customer joined queue" appears for staff.

### Maps to ACs: AC-4, AC-5, AC-10, AC-11, AC-12, AC-15, AC-17

---

## Task 5: Staff Restaurant Profile CRUD Endpoints + Sync with Shared Restaurant Model

**Status**: pending
**Priority**: medium
**Depends on**: Task 1

### Description

Add endpoints:
- `GET /api/staff/restaurant` → returns the shared Restaurant model doc for the staff's customerRestaurantId (return all fields: name, description, location, openingHours, cuisine, rating, reviewCount, photoFileId, imageUrl). Staff cannot edit rating/reviewCount; include them read-only.
- `PUT /api/staff/restaurant` → accepts body `{ name?, description?, location?, openingHours?: {open, close}?, cuisine? }`. Validate:
  - Strings not empty when provided; max length 120 name, 1000 description.
  - open/close HH:MM format.
- Validation errors → StaffError 400.
- Save ONLY to the shared `Restaurant` model (this is the source of truth for customers). After save, also denormalize `name` and `location` into StaffRestaurant record (to keep legacy name-match working if someone's db still in backfill state).
- Return updated Restaurant doc.
- Existing photo endpoints `/api/staff/restaurant-photo GET/PUT/DELETE` stay intact; already save to shared Restaurant.

### Files to modify

- `backend/src/staff/routes.ts` — add `staffRoutes.get('/restaurant', …)` and `staffRoutes.put('/restaurant', …)` before the error handler middleware.

### Test Requirements

#### rule
TR-5.1. Staff GET `/restaurant` returns the shared Restaurant document (name='Ember & Oak') with correct rating 4.6.
TR-5.2. Staff PUT `/restaurant` body `{ "cuisine": "Sri Lankan Fusion" }` → response has new cuisine. Public customer GET `/api/restaurants/:id` returns same cuisine on next call; DB Restaurant doc updated.
TR-5.3. Staff PUT invalid `{ "openingHours": { open: "25:00", close: "23:00" } }` → 400; Restaurant doc unchanged.
TR-5.4. Staff PUT empty name or name 300 chars → 400 with clear error.

### Maps to ACs: AC-6, AC-15

---

## Task 6: Customer Mobile — Remove Hardcoded Fallbacks + Add Photo to Reservation Cards

**Status**: pending
**Priority**: high
**Depends on**: Backend tasks (Tasks 3, 5 can be done in parallel with frontend)

### Description

Remove masking hardcoded fallbacks so when backend API data is absent the user sees a loading indicator, not fake "Ember & Oak" content with "4.6 rating" and "25 min wait".

Files:

**(a) `mobile/app/home.tsx`**:
- L110: change `{restaurant?.name || 'Ember & Oak'}` → `{restaurant?.name || (loading ? 'Loading…' : 'Restaurant unavailable')}`.
- Rating container L112: change hardcoded 4.6 and 1.2k → use `restaurant?.rating?.toFixed(1)` + `restaurant?.reviewCount` display format "({reviewCountDisplay} reviews)". If restaurant absent → hide rating row or show dashes.
- Location L115: `{restaurant?.location || '—'}` not hardcoded fallback to Colombo.
- statsContainer (current wait, in queue, tables available): replace 25 mins / 12 / 8 with values from restaurant object (currentWaitTime, queueLength, availableTables). If loading → show ActivityIndicator inside statValue cell; if restaurant is null → "—".
- Keep image placeholder text "Restaurant Image" and heart emoji features; those are UI/UX placeholders not data masks.

**(b) `mobile/app/restaurant.tsx`**:
- Stats L159: change `restaurant.currentWaitTime || 25` → `restaurant.currentWaitTime` (with "N/A" fallback, not default 25).
- L166 queue length 12 fallback → remove `?? 12`.
- L173 availableTables 8 fallback → remove.
- Ensure loading state shows ActivityIndicator the whole screen before rendering stats.

**(c) `mobile/app/reservations.tsx`**:
- Reservation list cards: add a photo thumbnail next to restaurant name. Since `GET /api/reservations` populates restaurantId, use the photoUri helper or construct `/api/restaurants/${restaurantId._id}/photo` explicitly. Style: 60×60 rounded image on the left of each card, same row as title+status badge. If no photo, show placeholder icon (no hardcoded asset for restaurant).
- Also ensure backend controller `getMyReservations` populates enough to get the photoFileId or imageUrl (Task 7 backend change).

### Files to modify

- `mobile/app/home.tsx`
- `mobile/app/restaurant.tsx`
- `mobile/app/reservations.tsx`

### Test Requirements

#### rule
TR-6.1. Stop backend server. Open customer app, navigate to home after prior login. Home page does NOT show the text "Ember & Oak" as restaurant name when no API data returned (it shows Restaurant unavailable or Loading…). Verify by search for the literal "Ember & Oak" in rendered output. Rating row doesn't render "4.6 (1.2k reviews)" — either blank or dashes. Stats don't render hardcoded 25/12/8.
TR-6.2. Start backend server. Reload home. API values render correctly: restaurant name Ember & Oak, rating 4.6, wait=2 * current queue length from backend, etc. Values match `GET /api/restaurants` JSON.
TR-6.3. Reservation list with an existing confirmed reservation shows a thumbnail image (loads the restaurant photo URL). Network tab shows GET /api/restaurants/<id>/photo returning 200 for that card or 404 with graceful fallback.
TR-6.4. `npx tsc --noEmit` in mobile/ passes.
TR-6.5. Restaurant Details page stat Current Wait Time = API value only; no fake fallback of "~25 minutes" when value not yet loaded (shows indicator instead).

### Maps to ACs: AC-8, AC-9, AC-19

---

## Task 7: Backend Customer Controllers — Populate photo info; Staff Notification Creation on Customer Actions

**Status**: pending
**Priority**: high
**Depends on**: Task 1, Task 2 (reverse lookup helper)

### Description

**Part A — Reservations & Queue list populate photo info**:
In `reservationController.ts` functions:
- `getMyReservations`: change `.populate('restaurantId', 'name location')` → `.populate('restaurantId', 'name location photoFileId imageUrl')` (and also compute imageUrl from photoFileId if it's not set on the doc, like in listRestaurants controller — OR let the frontend use photoUri helper with `/restaurants/:id/photo` which works even without imageUrl populated. Simpler: just add photoFileId to populate select, frontend can construct URL itself.)
- `getReservationById`: same populate change.
- `createReservation`, `cancelReservation`, `modifyReservation` — after success, use helper `emitStaffNotificationForCustomerAction(restaurantId, message, category, session?)` that finds StaffRestaurant via reverse lookup and creates a StaffNotification.

In `queueController.ts`:
- `getQueueHistory` → populate restaurantId include photoFileId imageUrl.
- `getActiveQueue` and `getQueueStatus` → same if returning entry with restaurantId populated.
- `joinQueue`, `cancelQueue` → after success: emit StaffNotification (Queue category).

**Part B — emit helper**:
Add to `staffSync.ts` (from task 2):
```typescript
async function findStaffRestaurantByCustomerId(customerRestaurantId: ObjectId | string) {
  return StaffRestaurant.findOne({ customerRestaurantId });
}
async function emitStaffNotification(customerRestaurantId, message, category, partyId?, tableId?) {
  const staffRest = await findStaffRestaurantByCustomerId(customerRestaurantId);
  if (!staffRest) return;
  await StaffNotification.create({ restaurantId: staffRest._id, message, category, partyId, tableId });
  await StaffEvent.create({ restaurantId: staffRest._id, actorName: 'Customer App', message, category, partyId, tableId });
}
```
Catch errors silently (console.error) since staff notifications are best-effort and shouldn't break customer's reservation success response.

### Files to modify

- `backend/src/controllers/reservationController.ts`
- `backend/src/controllers/queueController.ts`
- `backend/src/utils/staffSync.ts` (add findStaffRestaurantByCustomerId + emitStaffNotification)

### Test Requirements

#### rule
TR-7.1. GET `/api/reservations` response JSON → each entry's restaurantId object contains photoFileId key OR imageUrl key (verify with jq).
TR-7.2. Customer cancels reservation → StaffNotification collection contains new entry with message containing "cancelled".
TR-7.3. Customer joins queue → StaffNotification for restaurant with Queue category and message containing "joined queue".
TR-7.4. Reservation create emits StaffNotification for linked restaurant with category Reservations containing message like "New online reservation…".
TR-7.5. tsc clean.

### Maps to ACs: AC-9, AC-10, AC-11, AC-12

---

## Task 8: Staff Profile Screen — Editable Restaurant Details (name, desc, address, hours, cuisine) + Type Checks + Integration Flow Verify

**Status**: pending
**Priority**: medium
**Depends on**: Task 5 (backend endpoints); all tasks 1-7

### Description

**(a) Staff Profile Screen**

In `mobile/src/components/staff/StaffScreens.tsx` function `ProfileScreen()` (around line 217):
Below the photo upload/remove controls, before the "Log out" button area, add a new Card with heading "Restaurant Information" containing editable fields and Save button using `useMutation`.

Fields:
- Restaurant Name (text input, value loaded from `dash.data?.restaurant?.name` or separate staff `/restaurant` GET call).
- Description (multiline, loaded same way)
- Location / Address (text)
- Cuisine (text)
- Opening Open (HH:MM text, value e.g. "11:00")
- Opening Close (HH:MM text, value "23:00")

On mount or focus, call `getStaffData('restaurant')` to fetch latest shared Restaurant model.

On Save: `patchStaffData` (or use PUT method via helper `putStaffData(path, body)` in staffData.ts — first add a `putStaffData` helper to staffData.ts if missing) → `PUT /api/staff/restaurant`.

Success toast / feedback via successMsg state pattern already used for photo ("Saved successfully."). Use same pattern with setTimeout clear.

**(b) Add put helper**

If missing in `mobile/src/services/staffData.ts`:
```typescript
export const putStaffData = async <T,>(path: string, body: unknown): Promise<T> =>
  (await staffApi.put<T>(`/api/staff/${path}`, body)).data;
```

**(c) Integration Verification Steps**

After all code written, run:
1. Backend `npx tsc --noEmit` (from backend/ dir). Fix errors.
2. Mobile `npx tsc --noEmit` (from mobile/ dir). Fix errors.
3. Manual end-to-end verification:

Test A (Restaurant data flow):
- Login as Staff. Go to Profile → edit Restaurant Cuisine from "Modern International" to "Sri Lankan Fusion". Save.
- Open another browser / device → Customer home (or public curl `GET /api/restaurants`) → cuisine = Sri Lankan Fusion.
- Upload a photo; confirm home card shows new photo.

Test B (Reservation):
- Customer login → Restaurant Details → create reservation for tonight 7PM, 4 people. Receive Reservation Confirmed.
- In another tab, Staff login → Dashboard → Reservations tab. Customer's reservation appears under Today / Upcoming.
- Staff opens it → actions: click "Cancel" & confirm. Then go back to Customer app → Bookings list → status = Cancelled. Pull to refresh; status updated. Notifications badge increments.

Test C (Queue):
- Customer joins virtual queue for Ember & Oak (4 guests).
- Staff Queue tab shows entry Q-001 with 4 guests in Waiting.
- Staff taps it → Send Table Ready alert → OK.
- Customer queue status screen polls → status "called" / next in queue; notification appears "Your table is ready!".
- Staff Assign Table, mode=seat → Customer QueueEntry becomes seated; remaining positions recalculated.

Test D (Security):
- Via curl: create a Restaurant B in DB manually (name "Test B", location "Negombo", etc.). Use mongo shell or temporary script to insert one Reservation for RestaurantB.
- Use Staff JWT for original "Ember & Oak". GET /api/staff/parties?kind=reservation → count does NOT include the RestaurantB reservation.
- Try PATCH /api/staff/parties/res_BADID directly → 403/404 response.

Test E (Photo):
- Staff upload new 400KB jpg. Check GridFS files collection has restaurant-photos.files entry.
- Restaurant document photoFileId matches.
- Public GET /api/restaurants/:id/photo → 200, correct bytes, Content-Type image/jpeg.
- Customer card image source returns 200, no broken image icon.

Test F (Hardcoded fallbacks removed):
- Stop backend server; start mobile. Navigate Home → no static "Ember & Oak" data. Shows "Restaurant unavailable" or Loading. Open Restaurant Details → Loading indicator + error. Start backend; refresh → real data appears.

### Files to modify

- `mobile/src/services/staffData.ts` — add putStaffData export if missing.
- `mobile/src/components/staff/StaffScreens.tsx` — ProfileScreen add restaurant details editable section + Save.
- Then run verification steps (no file changes in this task for those).

### Test Requirements

#### rule
TR-8.1. `backend/` directory: `npx tsc --noEmit` exit 0.
TR-8.2. `mobile/` directory: `npx tsc --noEmit` exit 0.
TR-8.3. Manual Test A passes: Staff edit cuisine → public API returns new value.
TR-8.4. Manual Test B passes: customer creates reservation → staff sees it → staff cancels → customer sees Cancelled.
TR-8.5. Manual Test C passes: customer joins queue → staff sees → alert ready → customer status=called → Assign Table seats customer.
TR-8.6. Manual Test D passes: Staff cannot see Restaurant B reservations.
TR-8.7. Manual Test E passes: photo upload → GridFS + customer view.
TR-8.8. Manual Test F passes: backend down → no fake data, just loading+error.
TR-8.9. `npx expo lint` from mobile/ exits 0 (or no new lint errors added compared to baseline; run before and after to compare).

### Maps to ACs: AC-6 (Staff Profile save round-trip), AC-8, AC-9, AC-13, AC-14, AC-15, AC-16, AC-18, AC-19

---

## Task 9: Independent Review

**Status**: pending
**Priority**: medium
**Depends on**: Tasks 1-8 ALL TR pass.

### Description

Independent read-only review pass validating:
- All 19 ACs have passing recorded evidence.
- TypeScript passes on both repos (commands run fresh by reviewer).
- Backend endpoints (at least 12 critical ones) verified via curl / Thunder Client: `/staff/restaurant PUT`, `/staff/parties?kind=reservation` (merged list), `/staff/parties/res_<id> PATCH cancel`, queue alert ready → status changes, public `/api/restaurants/:id/photo` 200.
- Customer & Staff login flows still work with valid credentials; invalid credentials return 401.
- No cross-restaurant access (verify with dual restaurants in DB or mock).
- No hardcoded fallback strings leaked into mobile screens (grep review).

Reviewer Contract provided in Review gate spec. Produce `review.md` with result: pass | fail | blocked. If fail → ≥ 1 actionable pending task added to tasks.md as remediation.

### Maps to ACs: All ACs (comprehensive gate).
