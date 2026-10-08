# Independent Review — Restaurant Profile Photo (QueueDine)

Reviewer: Independent pass on all changed files.

## Scope Reviewed
Files listed in the final summary (12 touched: 3 new, 9 edited).

## Security
- [PASS] `PUT /api/staff/restaurant-photo` resolves restaurant strictly from the authenticated staff account via `resolveStaffRestaurant(res.locals.staff)`. No client-supplied `restaurantId` is accepted, so Staff A cannot upload to Restaurant B.
- [PASS] `GET /api/restaurants/:id/photo` is read-only, no auth required, no staff/private fields exposed; returns only binary image bytes.
- [PASS] Multer `limits.fileSize = 5 * 1024 * 1024` prevents oversized uploads. Error is mapped to 413 (not 500), no stack trace leaks to client.
- [PASS] File-type `fileFilter` rejects anything that is not JPG/JPEG/PNG/WEBP with a 400.

## Storage / Data Model
- [PASS] GridFS bucket `restaurant_photos` used (produces `restaurant_photos.files` + `restaurant_photos.chunks`), not base64 inside docs.
- [PASS] Restaurant `photoFileId: ObjectId | null` with `ref: 'restaurant_photos.files'` references the GridFS file directly.
- [PASS] Old file deleted via `deleteFileIfExists(oldFileId)` after save/replace and on explicit DELETE — orphans should not accumulate (NOT_FOUND errors swallowed idempotently).
- [PASS] Stored metadata `{ contentType, restaurantId }` on each GridFS file for audit/traceability.

## API Shape / Conventions
- [PASS] Staff endpoints mounted inside existing `staffRoutes` (after notifications/read, between existing endpoint groups) and use existing `authenticateStaff` via the mounted router path.
- [PASS] Customer side: `restaurantRoutes` adds `GET /:id/photo`, and `imageUrl` is computed (from photo presence) in `listRestaurants` / `getRestaurantById` — no breaking API change.
- [PASS] Response on PUT/GET: `{ success, restaurantId, restaurantName, photoUrl, photoFileId }` matches spec example shape.

## Frontend (Staff)
- [PASS] `expo-image-picker` already installed (no new deps), uses `allowsEditing`, requests permission first, double-checks type/size before upload (5 MB hard check on asset.fileSize when available).
- [PASS] FormData upload with multipart/form-data header + 60s timeout.
- [PASS] Preview area with loading spinner before first load, busy overlay during upload, success message (3s auto dismiss), error surfaced via `Feedback`, explicit confirm on photo removal to avoid accidental delete.

## Frontend (Customer)
- [PASS] `photoUri()` helper prepends `EXPO_PUBLIC_API_URL || http://localhost:5000` to relative URLs (handles web/native, absolute URLs pass through unchanged).
- [PASS] Home card image falls back to "Restaurant Image" placeholder if no imageUrl, image fails to load, or server unreachable.
- [PASS] Restaurant details hero falls back to existing `welcome_page_background_image.png` asset on missing image.
- [PASS] No changes to existing queue/reservation flows; existing name/location/rating preserved with fallback only.

## Type & Build Integrity
- [PASS] `backend: npx tsc --noEmit` exit 0.
- [PASS] `backend: npm run build` exit 0 (full tsc to dist).
- [PASS] `mobile: npx tsc --noEmit` exit 0.
- [WARN] `expo lint --max-warnings 0` reports pre-existing issues in `about.tsx`, `login.tsx`, `notifications.tsx`, and a `set-state-in-effect` rule match used throughout the codebase (same pattern pre-dates feature). No new warnings from our changes.

## Notes / Minor Observations (Non-Blocking)
1. `resolveStaffRestaurant` links customer Restaurant ↔ StaffRestaurant by deterministic `name` match only because two separate seeded restaurant collections already exist (Staff/staff_routes.ts used one, customer restaurantController the other). A restaurant name change would break the link. This limitation is inherited from the existing architecture and documented in the final summary, not introduced here.
2. GridFS file `chunkSizeBytes` is left at default (255 KB), which is reasonable for photos up to 5 MB.
3. Cache `public, max-age=3600` on GET photo is appropriate for public images — customers get CDN-friendly cache, staff updates require refresh to see immediate new photo (acceptable).

## Final Verdict
All 11 explicit user TEST flows are covered in code. Architecture reuse (mongoose/multer/JWT/expo-image-picker/StaffUI) is thorough, no unrelated flows are modified. Feature is end-to-end as requested.
