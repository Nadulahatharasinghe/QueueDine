# QueueDine Restaurant Photo — Implementation Tasks

Derived from `restaurant-photo-spec.md`. Each parent AC is cross-referenced.

---

## Task 1: Backend — Model Updates & Upload Filter Tightening

**Status**: pending
**Priority**: high
**Depends on**: none

### Description

Add `photoFileId` to the customer Restaurant model as a nullable ObjectId referencing a GridFS file. Tighten the existing multer upload utility to accept only JPG/JPEG/PNG/WEBP (currently allows GIF too). No new collections yet in this task.

### Files to create/modify

- Modify `backend/src/models/Restaurant.ts` → add `photoFileId?: mongoose.Types.ObjectId | null` field and adjust the `IRestaurant` interface.
- Modify `backend/src/utils/upload.ts` → change `fileFilter` allowed types regex to `/jpeg|jpg|png|webp/`; update error message to mention "JPG, JPEG, PNG, and WEBP".

### Test Requirements (TR)

#### rule
TR-1.1. `npx tsc --noEmit` in `backend/` exits 0 after model change.
TR-1.2. After re-seeding, `Restaurant.findOne({ name: 'Ember & Oak' })` has `photoFileId === null` and `imageUrl === null`.
TR-1.3. Uploading a `.gif` through `upload` middleware rejects with the new WEBP-aware error message.

### Maps to ACs: AC-3, AC-6, AC-12

---

## Task 2: Backend — GridFS Bucket Helper & Restaurant Link Resolver

**Status**: pending
**Priority**: high
**Depends on**: Task 1

### Description

Add a small helper module that creates a GridFS bucket named `restaurant_photos` using the existing mongoose connection. Add another helper that, given a staff account, resolves the customer `Restaurant` document by (1) loading the `StaffRestaurant` via `account.restaurantId`, then (2) finding the customer `Restaurant` whose `name` matches `StaffRestaurant.name`. If either lookup fails, the helpers throw structured errors the routes can convert to HTTP.

### Files

- Create `backend/src/utils/gridfs.ts` → exports `getRestaurantPhotosBucket(): Promise<mongodb.GridFSBucket>`, `async deleteFileIfExists(bucket, fileId)`, and `async storePhoto(buffer, opts): Promise<{ _id: mongodb.ObjectId; filename: string; contentType: string }>` (opens upload stream, writes the buffer, returns the file doc).
- Create `backend/src/utils/restaurantLink.ts` → `async resolveStaffRestaurant(account): Promise<{ staffRestaurant: StaffRestaurantDoc, customerRestaurant: RestaurantDoc }>`. Throws 503-shaped error if no link found.
- Re-export from `backend/src/utils/index.ts` if needed, or import directly.

### TR

#### rule
TR-2.1. `getRestaurantPhotosBucket()` returns a GridFSBucket with `bucketName === 'restaurant_photos'` and uses `mongoose.connection.db`.
TR-2.2. `storePhoto` on a 1KB PNG buffer inserts exactly one `restaurant_photos.files` doc and one chunk (`restaurant_photos.chunks`) when chunk size is default 255KB.
TR-2.3. `resolveStaffRestaurant` with the seeded staff host account returns `customerRestaurant.name === 'Ember & Oak'`.
TR-2.4. `deleteFileIfExists` of a nonexistent ObjectId resolves successfully (no throw). Delete of the ID from TR-2.2 removes both the `.files` and `.chunks` records.

### Maps to ACs: AC-2, AC-3, AC-4, AC-5, AC-12, AC-14

---

## Task 3: Backend — Staff Photo Endpoints (GET / PUT / DELETE)

**Status**: pending
**Priority**: high
**Depends on**: Task 2

### Description

Wire the three authenticated staff endpoints into `backend/src/staff/routes.ts` using the existing auth middleware chain. Use `upload.single('photo')` multer middleware on the PUT. Handle multer errors explicitly so size/type errors are user friendly.

Endpoints:

| Method | Path | Controller logic |
|--------|------|------------------|
| `GET` | `/api/staff/restaurant-photo` | `resolveStaffRestaurant` → return `{ success: true, photoFileId: r.photoFileId, photoUrl: r.imageUrl, restaurantId: r._id, restaurantName: r.name }`. |
| `PUT` | `/api/staff/restaurant-photo` | `upload.single('photo')` → if no file: 400. Validate `file.size > 0`, `file.mimetype` matches allowed. `resolveStaffRestaurant` → `storePhoto` → if old `photoFileId` exists, `deleteFileIfExists` → set customer restaurant `photoFileId` and `imageUrl = '/api/restaurants/{_id}/photo'` → save → return OK with the same shape as GET. |
| `DELETE` | `/api/staff/restaurant-photo` | `resolveStaffRestaurant` → if `photoFileId` exists, `deleteFileIfExists` → set `photoFileId = null`, `imageUrl = null` → save → return 200 `{ success: true, message: 'Photo removed.' }`. |

Also add multer error wrapper in the staff routes error handler: convert `LIMIT_FILE_SIZE` to 413, convert file-filter errors to 400 with correct text.

### Files

- Modify `backend/src/staff/routes.ts` → add the three routes, multer middleware, and error-shaping in the existing error handler.

### TR

#### rule
TR-3.1. `GET /api/staff/restaurant-photo` without token → 401 `Your staff session has expired.` (same as other endpoints).
TR-3.2. `PUT /api/staff/restaurant-photo` with no multipart file → 400 `{ error: "No photo file selected." }`.
TR-3.3. PUT with a 6 MB mock buffer (type `image/jpeg`) → 413 `{ error: "Photo exceeds the 5 MB limit." }`.
TR-3.4. PUT with a valid in-range JPG buffer → 200 response includes `photoUrl === '/api/restaurants/<id>/photo'`, and the Restaurant has the non-null `photoFileId` matching an `restaurant_photos.files._id`.
TR-3.5. PUT twice (different valid images): first GridFS `photoFileId` no longer exists in `restaurant_photos.files` after the second call (old file cleaned up).
TR-3.6. DELETE after upload: Restaurant.photoFileId becomes null, GridFS file is gone, second DELETE still returns 200 without throwing.
TR-3.7. Ownership isolation: create a second StaffRestaurant/staff for a different name. Staff A cannot read/write/delete Staff B's restaurant photo through these endpoints because `resolveStaffRestaurant` uses only the authenticated account's `restaurantId`.

### Maps to ACs: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-11, AC-14

---

## Task 4: Backend — Public Photo Retrieval + Restaurant Controller Updates

**Status**: pending
**Priority**: high
**Depends on**: Task 2, Task 3 (can run concurrently after Task 2)

### Description

Add the public image stream endpoint to `restaurantRoutes.ts`, and extend `listRestaurants` / `getRestaurantById` so the response `imageUrl` always reflects the correct public URL when a photo exists.

Routes to add:
- `GET /api/restaurants/:id/photo` → look up Restaurant by id → if no `photoFileId` → 404 `{ error: 'Restaurant photo not found' }`. Otherwise open a GridFSBucket download stream by `photoFileId`, set `res.contentType(file.contentType || 'image/jpeg')`, pipe the stream into `res`. Handle stream errors (file missing → 404, not throw).

Controller updates in `restaurantController.ts`:
- In both `listRestaurants` and `getRestaurantById` builds the response object: when `r.photoFileId` is set, set `imageUrl = `/api/restaurants/${r._id}/photo``. Otherwise keep current behavior (`imageUrl: r.imageUrl || null`).

### Files

- Modify `backend/src/routes/restaurantRoutes.ts` → add `GET /:id/photo` route.
- Modify `backend/src/controllers/restaurantController.ts` → add `getRestaurantPhoto` action, and adjust the two existing response builders.

### TR

#### rule
TR-4.1. `GET /api/restaurants/<id>/photo` for a restaurant with photo stored returns `Content-Type: image/jpeg` (or image/png based on stored type) and the body length matches the stored file length.
TR-4.2. Same endpoint for a restaurant without a photo → 404 JSON error; no server crash / unhandled stream error.
TR-4.3. `GET /api/restaurants` (public list) after upload returns the correct `imageUrl` value matching `/api/restaurants/<id>/photo` for the record with a photo.
TR-4.4. After DELETE in Task 3, list and detail return `imageUrl: null`.

### Maps to ACs: AC-7, AC-8, AC-10, AC-12

---

## Task 5: Mobile — Type & Service Updates

**Status**: pending
**Priority**: high
**Depends on**: none (can run parallel with backend tasks)

### Description

Update the frontend TypeScript interfaces and service modules so the staff upload flow and customer display flow have typed endpoints.

Changes:
1. `mobile/src/services/staffData.ts` → extend `Restaurant` interface (line 18) with optional `photoUrl?: string | null`. Add typed helpers: `getStaffRestaurantPhoto`, `putStaffRestaurantPhoto(formData: FormData): Promise<{ success:boolean, photoUrl:string|null, photoFileId:string|null, restaurantId:string, restaurantName:string }>`, `deleteStaffRestaurantPhoto(): Promise<{ success:boolean }>`. All three use `staffApi` against `/api/staff/restaurant-photo`, with PUT using `headers: { 'Content-Type': 'multipart/form-data' }`.
2. `mobile/src/services/restaurantService.ts` → export helper `photoUri(relative: string | null | undefined): string | null` that prepends the API base URL. Reuse the same `API_URL` logic as `api.ts`.
3. `mobile/src/types/index.ts` → `Restaurant.imageUrl` type is already `string | null | undefined` — leave as is.

### Files

- Modify `mobile/src/services/staffData.ts`.
- Modify `mobile/src/services/restaurantService.ts`.

### TR

#### rule
TR-5.1. `npx tsc --noEmit` in `mobile/` exits 0.
TR-5.2. `photoUri('/api/restaurants/x/photo')` returns full absolute URL with the configured EXPO_PUBLIC_API_URL prefix.
TR-5.3. `photoUri(null)` returns null.

### Maps to ACs: AC-9, AC-10, AC-13

---

## Task 6: Mobile — Staff Profile Restaurant Photo Section

**Status**: pending
**Priority**: high
**Depends on**: Task 5 (types/services). Wait for backend to be implemented or mock the responses for UI-first.

### Description

Insert a `Card` titled "Restaurant Photo" inside the `ProfileScreen` component of `StaffScreens.tsx`, between the profile hero and the shortcut card list.

Card contents:
- Preview: a 160pt rounded box, border `#E4E7EC`. If photoUrl is truthy, render `<Image source={{ uri: buildFullUrl(photoUrl) }} style={{ width: '100%', height: 160, borderRadius: 14 }} resizeMode="cover" />`. Else placeholder text "No photo uploaded" in muted text.
- Button row: if no photo → single primary `Button title="Upload Photo"`; if photo → secondary `Button title="Change Photo"` and `Button title="Remove Photo" secondary danger`.
- Remove → `useMutation` confirm dialog using the same Card confirm pattern as logout (`confirm` boolean state).
- Use `expo-image-picker` `launchImageLibraryAsync`: allow images only, allow editing, quality 0.9. Frontend pre-validate: reject wrong extensions (show a red Feedback), reject size > 5MB.
- Upload: build `FormData` on React Native (for web, use standard `FormData`; for native, the `{ uri, type, name }` triplet). Call `putStaffRestaurantPhoto`.
- On success: set local preview URL, show green "Photo saved." feedback, and call `dash.reload()` so the dashboard resource picks up any `photoUrl` on the embedded restaurant.
- On any error: show `Feedback error={mutation.error}`.
- Add import `* as ImagePicker from 'expo-image-picker'` at the top of `StaffScreens.tsx` (library already installed).

### Files

- Modify `mobile/src/components/staff/StaffScreens.tsx` → edit `ProfileScreen`.

### TR

#### rule
TR-6.1. TypeScript check passes.
TR-6.2. Profile screen renders the new "Restaurant Photo" card between hero and shortcut list without breaking the existing shortcut row layout.
TR-6.3. Staff flow: tap Upload → pick valid JPG → loading state visible → success feedback → preview shows the image.
TR-6.4. Tap Remove → confirm → photo cleared → preview shows placeholder again.
TR-6.5. After TR-6.3 completes, screen reload (manual app reload / reopen Profile) still displays the photo because data comes from GET endpoint.
TR-6.6. Pick a >5 MB file → frontend shows "Photo exceeds the 5 MB limit" error before any network request.
TR-6.7. Pick a non-image file (e.g. PDF if file picker allows) → frontend shows format error before network request.

### Maps to ACs: AC-9, AC-11, AC-13

---

## Task 7: Mobile — Customer Home & Restaurant Details Photo Display

**Status**: pending
**Priority**: high
**Depends on**: Task 5

### Description

Update the customer Home screen and Restaurant Details screen to use the uploaded restaurant photo.

**Home screen** (`mobile/app/home.tsx`):
- Fetch real restaurant data using `getFirstRestaurant()` on mount + `useFocusEffect` for refresh. Store in local state.
- Keep existing greeting and bottom nav intact.
- In the `restaurantImage` view: if `restaurant?.imageUrl` is truthy → replace placeholder Text with `<Image source={{ uri: photoUri(restaurant.imageUrl) }} style={{ width: '100%', height: 200 }} resizeMode="cover" />`. Add basic `onError` fallback: clear image URI back to placeholder if network fails.
- All existing text fields can switch from hardcoded to the `restaurant` data (name/location/rating/reviewCount) — wait time stats already populated from a placeholder, leave those computed separately as a follow-up is not in scope, they currently show hardcoded `~25 mins / 12 / 8` values so this task changes ONLY the image.

**Restaurant Details** (`mobile/app/restaurant.tsx`):
- Currently loads `require('../assets/welcome_page_background_image.png')` statically.
- Change: `const heroSource = restaurant.imageUrl ? { uri: photoUri(restaurant.imageUrl) } : require('../assets/welcome_page_background_image.png');`. Use `heroSource` as the `<Image source=...>`.
- Add `onError={() => setImageFailed(true)}` state so broken image falls back to local asset.

Import `photoUri` from `restaurantService.ts`.

### Files

- Modify `mobile/app/home.tsx`.
- Modify `mobile/app/restaurant.tsx`.

### TR

#### rule
TR-7.1. TypeScript check passes.
TR-7.2. With NO photo uploaded: Home still shows placeholder text; Restaurant Details still shows the local welcome asset. No visual regression of other sections.
TR-7.3. After a staff upload of a JPG, Home restaurant card now shows the new network image (no placeholder text), and Restaurant Details hero uses the same network image.
TR-7.4. Broken image URL → both screens fall back to placeholder without crash or RedBox.
TR-7.5. Navigation from Home → Restaurant Details continues to work (no regressions).

### Maps to ACs: AC-10, AC-11, AC-13

---

## Task 8: Typecheck, Verification Run, & MongoDB Atlas Checks

**Status**: pending
**Priority**: high
**Depends on**: Task 1–7 all TR pass

### Description

Run the full verification:
1. `backend\ npx tsc --noEmit` → exit 0.
2. `mobile\ npx tsc --noEmit` → exit 0.
3. `mobile\ npx expo lint` → clean.
4. Start backend: `cd backend ; npx tsx src/server.ts`. Verify all existing endpoints still respond (quick curl of staff/login → me, dashboard, restaurants list, tables, parties).
5. Run the 11-step manual test protocol defined in the user's request (upload → verify persists → refresh → customer sees it → replace → delete → isolation).
6. Use MongoDB Atlas / Compass to inspect:
   - `restaurants` collection: document has `photoFileId` ObjectId and correct `imageUrl` after upload.
   - `restaurant_photos.files`: one doc with `metadata.restaurantId` if stored, at least matching `_id === restaurant.photoFileId`, correct `length`, `contentType`, `chunkSize`.
   - `restaurant_photos.chunks`: count matches `ceil(length/chunkSize)`.
   - After replace/delete, old `files`/`chunks` are gone.
7. Record evidence (screenshots / curl outputs) into this task's `Completion Evidence`.

### Files

- No new files. Fix any TS/lint regressions found.

### TR

#### rule
TR-8.1. Backend TypeScript check: exit 0.
TR-8.2. Mobile TypeScript check: exit 0.
TR-8.3. `npx expo lint` no errors.
TR-8.4. User's TEST 1 through TEST 11 all complete successfully:
  - TEST 1–2: Staff login, open /staff/profile.
  - TEST 3–5: Upload, response success, Atlas has GridFS data.
  - TEST 6: Refresh profile → photo persists.
  - TEST 7–8: Customer app → restaurant listing/details → same photo displayed.
  - TEST 9–10: Replace photo from staff → customer sees new photo on next load.
  - TEST 11: Two staff accounts for different restaurants → cannot cross-modify.
TR-8.5. Existing features intact (staff login/dashboard/queue/reservations/notifications; customer login/restaurant listing/reservations/queue) — each executed one happy-path action without error.

### Maps to ACs: AC-11, AC-12, AC-13, AC-14

---

## Task 9: Independent Review

**Status**: pending
**Priority**: medium
**Depends on**: Task 8 passes all TR

### Description

Independent read-only review pass against spec ACs and collected TR evidence.

Reviewer Contract:
1. Read `restaurant-photo-spec.md`, `tasks.md` (this file), and completion evidence from all tasks.
2. Inspect modified files:
   - `backend/src/models/Restaurant.ts`
   - `backend/src/utils/upload.ts`
   - `backend/src/utils/gridfs.ts` (new)
   - `backend/src/utils/restaurantLink.ts` (new)
   - `backend/src/staff/routes.ts`
   - `backend/src/routes/restaurantRoutes.ts`
   - `backend/src/controllers/restaurantController.ts`
   - `mobile/src/services/staffData.ts`
   - `mobile/src/services/restaurantService.ts`
   - `mobile/src/components/staff/StaffScreens.tsx`
   - `mobile/app/home.tsx`
   - `mobile/app/restaurant.tsx`
3. Re-run both `tsc --noEmit` checks.
4. Run at least 4 curl tests against a running backend:
   - (a) upload without token → 401.
   - (b) upload valid image → 200, record URL.
   - (c) GET public photo → 200 correct Content-Type.
   - (d) DELETE → subsequent public GET → 404.
5. Produce `review.md` with pass/fail/blocked result.
6. If fail → create ≥ 1 pending remediation task in `tasks.md` with actionable findings, not just vague complaints.

### Maps to ACs: All (AC-1 through AC-14)
