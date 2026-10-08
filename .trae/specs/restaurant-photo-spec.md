# QueueDine: Restaurant Profile Photo Feature Specification

## Problem

Restaurant staff currently have no way to upload, update, or remove a restaurant photo that is visible to customers. The customer-facing Home and Restaurant Details screens use hardcoded placeholder images instead of the actual restaurant photo uploaded by staff. Both the customer `Restaurant` model and the separate staff `StaffRestaurant` model exist without a photo-storage mechanism. The feature must store images safely in MongoDB using GridFS (not as base64 embedded strings), enforce strict staff-to-restaurant ownership, and automatically surface the uploaded photo on the customer mobile app without any customer action.

## Users

1.  **Authenticated Restaurant Staff (host / manager)**: Upload, replace, or remove the photo belonging to the restaurant they are assigned to via their staff account.
2.  **Authenticated / Unauthenticated Customers**: View the uploaded restaurant photo on the home page restaurant card and on the restaurant details hero banner.

## Goals

1.  Implement a staff-side "Restaurant Photo" section on the existing `/staff/profile` page. Support preview, pick via image picker, upload with loading state, and success/error feedback.
2.  Validate uploads: JPG/JPEG/PNG/WEBP only, maximum 5 MB.
3.  Store image binaries in MongoDB using GridFS via the existing mongoose connection. Never embed base64 inside a regular document.
4.  Associate each photo with the staff member's own restaurant only. Enforce that Staff A cannot modify Restaurant B's photo even with a crafted request.
5.  Reference the GridFS file from the customer-facing `Restaurant` model using a `photoFileId` field and populate `imageUrl` so existing API consumers receive the public photo URL without response breakage.
6.  Provide a public (unauthenticated) image-retrieval endpoint `GET /api/restaurants/:id/photo` that streams the file from GridFS with the correct `Content-Type`.
7.  Automatically display the photo on the customer Home page restaurant card and the Restaurant Details hero image when one exists, falling back to the current placeholder when none is set.
8.  Replacing or removing the photo correctly cleans up the previous GridFS file so unused images do not accumulate.
9.  Preserve all existing features: staff login/dashboard/queue/reservations/tables/notifications, customer login/restaurant listing/reservations/queue, existing MongoDB connection, and existing JWT auth.

## Non-Goals

- No new authentication system, no new login/register/profile flows.
- No third-party image service (Cloudinary, S3, Firebase, Imgur).
- No redesign of staff profile layout or customer screens beyond inserting the image component where the placeholder exists.
- No multi-restaurant UI changes or new management pages.
- No base64-in-document storage pattern.
- No changes to unrelated routes, models, or controllers.
- No changes to reservation/queue/favorites/notifications business logic.

---

## Functional Requirements

### 1. Backend — GridFS Storage & Restaurant Model Extension

**MongoDB connection**: reuse the existing mongoose connection (`backend/src/config/database.ts`). Access the native `mongodb` driver through `mongoose.connection.db` and `mongoose.connection.client` to create a GridFS bucket.

**Customer Restaurant model** (`backend/src/models/Restaurant.ts`):
- Add `photoFileId?: mongoose.Types.ObjectId | null` field pointing to a GridFS `fs.files._id`.
- Keep the existing `imageUrl?: string` field. On every upload/delete, set `imageUrl` to the publicly reachable photo URL string `/api/restaurants/{_id}/photo` (or `null` when removed).

**Staff models** (`backend/src/staff/models.ts`):
- No new collections are required. Staff endpoints resolve the restaurant through `StaffAccount.restaurantId` → `StaffRestaurant` → look up customer `Restaurant` by matching `StaffRestaurant.name === Restaurant.name` (the same deterministic name used by both seeds). If lookup ever fails, return a clear "Restaurant data not linked" 503 message.

**GridFS bucket name**: use `restaurant_photos` (collection prefix `restaurant_photos.files` and `restaurant_photos.chunks`) so the files are clearly separated from future upload types.

### 2. Backend — Staff Authenticated Endpoints

All endpoints live under the existing `staffRoutes` in `backend/src/staff/routes.ts`. They reuse the existing staff auth middleware (lines 40-54 in `staff/routes.ts`). The current staff account is read from `res.locals.staff` and yields the `restaurantId` for the StaffRestaurant lookup.

Use `multer` from `backend/src/utils/upload.ts` (already in project and configured with memory storage + 5 MB limit) and tighten the `fileFilter` to accept only `jpeg|jpg|png|webp`.

| Method | Path | Purpose |
|--------|------|---------|
| `PUT` | `/api/staff/restaurant-photo` | Upload or replace the restaurant photo. Accepts `multipart/form-data` with a single `photo` field. Returns photo metadata + URL. On replace, delete the prior GridFS file (if `photoFileId` existed) after the new file is successfully stored. |
| `GET` | `/api/staff/restaurant-photo` | Return the current photo info for the staff member's restaurant: `{ success: true, photoUrl: string \| null, photoFileId: string \| null, restaurantId: string, restaurantName: string }`. |
| `DELETE` | `/api/staff/restaurant-photo` | Remove the restaurant photo. Delete the GridFS file by `photoFileId` and set both `photoFileId` and `imageUrl` to `null` on the Restaurant. |

**Ownership rule**: Every endpoint resolves the customer `Restaurant` document ONLY through the authenticated staff account's own `StaffRestaurant`. A caller supplying any other restaurant identifier, or tampering with route params, cannot affect another restaurant.

**Validation**:
- `PUT` without file → 400 `{ error: "No photo file selected." }`.
- File filter rejects non-JPG/PNG/WEBP → multer error handler → 400 `{ error: "Only JPG, JPEG, PNG, and WEBP images are allowed." }`.
- File larger than 5 MB → multer LIMIT_FILE_SIZE → 413 `{ error: "Photo exceeds the 5 MB limit." }`.
- Staff with no linked `StaffRestaurant` or no matched customer `Restaurant` → 503.

### 3. Backend — Public Customer Photo Endpoint

Add to `backend/src/routes/restaurantRoutes.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/restaurants/:id/photo` | Stream the photo binary from the GridFS bucket for the customer Restaurant with `_id === params.id`. Returns `Content-Type` based on the stored `contentType`, falls back to `image/jpeg`. If no photo exists, redirect to a 404 or return a 404 JSON error. Range requests / caching headers are not required; plain 200 with the full binary satisfies the requirement. No auth required. |

Also extend `listRestaurants` and `getRestaurantById` in `restaurantController.ts` so the returned `imageUrl` is always populated with `/api/restaurants/{_id}/photo` when `photoFileId` is set; otherwise leave as `null` (current behavior).

### 4. Frontend — Staff Profile Photo Upload Section

Location: `ProfileScreen` component in `mobile/src/components/staff/StaffScreens.tsx` (the function that currently renders the avatar, staff name, role, and shortcut cards).

Insert a new `Card` between the profile hero and the shortcut list titled "Restaurant Photo". The card contains:
- A 160pt tall preview area (rounded 14, background `#F4F5F7`): shows current restaurant photo when present, otherwise a placeholder text "No photo uploaded".
- Buttons: when no photo → "Upload Photo"; when photo exists → "Change Photo" and "Remove Photo" (remove requires confirm step).
- Loading state: overlay an `ActivityIndicator` during upload/delete; disable buttons.
- Success / error text: show green confirmation for 3 seconds, or red error inline using the existing `<Feedback>` component pattern.

Use `expo-image-picker` (already installed in `mobile/package.json`). When user picks:
- `launchImageLibraryAsync` with `mediaTypes: ImagePicker.MediaTypeOptions.Images`, `quality: 0.9`, allows editing optional.
- Validate type/size on frontend before sending.
- Build `FormData` with field name `photo` and the picked asset `uri`, `type`, `name`.
- Send via `staffApi.put('/api/staff/restaurant-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } })`.
- After success, reload the staff dashboard resource so `dash.data.restaurant` refetches, and mirror the photo URL in the local component state.

Also update the `Restaurant` interface in `mobile/src/services/staffData.ts` to include optional `photoUrl?: string | null` so the dashboard GET response can carry it.

### 5. Frontend — Customer Side Display

Two screens to update, no new components required:

1. **`mobile/app/home.tsx`** — `styles.restaurantImage` placeholder box. Replace the placeholder `Text` with an `<Image>` whose `source` is `{ uri: buildFullUrl(restaurant.imageUrl) }` when `restaurant.imageUrl` is truthy, otherwise keep the existing placeholder. To support this, change the restaurant card to fetch real restaurant data via `getFirstRestaurant()` on mount instead of hardcoding "Ember & Oak".

2. **`mobile/app/restaurant.tsx`** — hero section currently loads static `welcome_page_background_image.png` asset. Change to: if `restaurant.imageUrl` is truthy → render `<Image source={{ uri: buildFullUrl(restaurant.imageUrl) }} style={styles.heroImage} resizeMode="cover" />`, else fall back to the existing local asset. Show a loading shimmer (or just the placeholder) while the network image is loading.

Build image URLs with the same `API_URL` base used by `apiClient` (`process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'`) so relative paths work on all environments. Export a helper `photoUri(relative: string | null | undefined): string | null` from `restaurantService.ts`.

---

## Non-Functional Requirements

1.  **Safety**: No base64 embedded inside regular MongoDB documents. GridFS stores the chunks; the Restaurant document holds only an ObjectId reference and a URL string.
2.  **Auth isolation**: Staff endpoints always use `res.locals.staff.restaurantId` to derive the target restaurant. Caller-supplied IDs or restaurant names are never trusted for write operations.
3.  **Cleanup on replace / delete**: Every successful `PUT` that finds an existing `photoFileId` must delete the old GridFS file idempotently (ignore "file not found" from GridFS delete). DELETE similarly cleans up.
4.  **Error hygiene**: Frontend messages are user-friendly (e.g., "That photo is too large. Choose a JPG under 5 MB."). Backend error responses never leak stack traces, URIs, or MongoDB details; use the same `StaffError` / generic `{ error }` shape as the rest of staff routes.
5.  **No regressions**: Staff login, dashboard, queue management, reservation management, tables, notifications, and the customer reservation/queue flows continue to behave identically. Customer auth/profile unchanged.
6.  **Type safety**: `npx tsc --noEmit` in both `backend` and `mobile` exits 0 after changes.
7.  **Dependencies**: Multer and expo-image-picker are already installed. No new npm packages are required.

## Constraints, Dependencies, Assumptions

- **MongoDB**: Uses existing `MONGODB_URI` env var and the existing mongoose connection. GridFS bucket is created lazily on first write (native driver does this automatically).
- **Staff ↔ Customer restaurant link**: Resolved by matching `StaffRestaurant.name === Restaurant.name`. The seed creates both sides with name `"Ember & Oak"`. In the future, a formal foreign key could replace this; for this feature, the deterministic name match is sufficient. If a customer Restaurant cannot be found, the endpoints return a clear error.
- **Image URL format**: Use relative path `/api/restaurants/{_id}/photo` stored in `Restaurant.imageUrl`. The frontend prepends the base API URL.
- **Image picker**: Use `expo-image-picker` already in `package.json`. The browser web target uses the library's web-compatible file picker automatically.
- **File size validation**: Frontend checks size from picked asset first; backend enforces again as the source of truth.
- **API URL**: From `EXPO_PUBLIC_API_URL` in mobile; for local dev defaults to `http://localhost:5000` matching `api.ts`.

## Open Questions (Resolved by Assumption)

1.  GridFS vs GridFSBucket? → Use `new mongoose.mongo.GridFSBucket(db, { bucketName: 'restaurant_photos' })` for streaming reads/writes.
2.  PUT vs POST for upload? → `PUT` because the operation is idempotent per restaurant (replacing the single photo).
3.  Remove-photo button? → Include it as a "Remove Photo" secondary button with confirm dialog, because it fits the existing architecture.
4.  Home screen data source? → Switch home to load from `getFirstRestaurant()` so the `imageUrl` is actually the uploaded one rather than a hardcoded card. All other text fields (name, rating, wait) will then reflect API data too.

---

## Acceptance Criteria

### rule

AC-1. Staff `PUT /api/staff/restaurant-photo` requires valid staff Bearer token. Missing / invalid token → 401 staff auth error.

AC-2. Given staff Alice belongs to Restaurant A, Alice's upload only writes to Restaurant A's `photoFileId`/`imageUrl` and never to Restaurant B even when an attacker crafts the payload. No other restaurant parameter is accepted on the route.

AC-3. Uploading a valid JPG/PNG/WEBP ≤ 5 MB → (a) creates exactly one file in `restaurant_photos.files` + chunks in `restaurant_photos.chunks`, (b) sets `Restaurant.photoFileId` to that file's `_id`, (c) sets `Restaurant.imageUrl = '/api/restaurants/{_id}/photo'`, (d) response `200 { success: true, restaurantId, restaurantName, photoUrl }`.

AC-4. Replacing the photo → previous GridFS file (`photoFileId` before update) is successfully deleted from `restaurant_photos.files` and `*.chunks`. Only the newest file remains in GridFS.

AC-5. `DELETE /api/staff/restaurant-photo` clears `photoFileId` and `imageUrl` on the Restaurant and deletes the corresponding GridFS file. Subsequent GET of the photo URL returns 404.

AC-6. Non-image / oversized file uploads return structured user-facing error messages (400 / 413) and never write a partial GridFS entry.

AC-7. `GET /api/restaurants/:id/photo` (public, no auth) streams the correct binary with matching `Content-Type` header. For a restaurant with no photo, it returns a 404 response.

AC-8. Public restaurant list (`GET /api/restaurants`) and detail (`GET /api/restaurants/:id`) return the correct `imageUrl` string matching `/api/restaurants/{_id}/photo` when a photo is set, else `null`. Existing fields are unchanged.

AC-9. Staff Profile screen, after upload, shows the uploaded photo preview and allows Change/Remove actions. Manual refresh of the page still shows the same photo.

AC-10. Customer Home restaurant card and Restaurant Details hero display the uploaded image after the server responds with the `imageUrl`. When no photo is set, both fall back to the current placeholders.

AC-11. Existing flows pass after implementation:
  - Staff login works; dashboard loads tables/queue/reservations count.
  - Staff queue, reservations, tables, notifications screens unchanged behavior.
  - Customer login; restaurant listing; restaurant detail; reservation create/cancel; queue join/cancel all work as before.
  - TypeScript checks pass for backend and mobile.

### rubric

AC-12. **Architecture fidelity (0-3)**:
  - 0: base64 stored directly in a document, or non-GridFS custom storage.
  - 1: GridFS used, but no cleanup of old files on replace/remove.
  - 2: GridFS with cleanup; model changes (photoFileId + imageUrl) correct.
  - 3: Staff auth identity is the sole source of restaurant ownership on write endpoints; public image endpoint streams correctly; customer APIs return the new `imageUrl` computed consistently.
  - Pass threshold: ≥ 2.

AC-13. **UI consistency (0-3)**:
  - 0: Profile screen layout reflowed or broke existing cards.
  - 1: Photo section inserted but styling does not match existing `Card`/`Button` design system.
  - 2: Photo section uses `Card` and `Button` from StaffUI; customer screens reuse existing Image containers without layout shift; error/success feedback matches existing patterns.
  - 3: Loading states, confirm dialog for remove, and graceful fallbacks (no photo → placeholder) match the rest of the app.
  - Pass threshold: ≥ 2.

AC-14. **Defense in depth (0-2)**:
  - 0: Accepts arbitrary restaurantId from request body in staff write endpoints.
  - 1: Uses staff account restaurant; missing some input validation.
  - 2: Frontend validates format/size first; backend re-enforces; ownership enforced through `res.locals.staff` only; multer filter rejects wrong MIME types; GridFS file IDs are never accepted from the client.
  - Pass threshold: ≥ 1.
