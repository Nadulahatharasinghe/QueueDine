# QueueDine staff portal

## Start

The portal uses the existing Expo app and Express backend. Customer screens, the `User` model, customer session keys, and `/api/auth` behavior are unchanged. All new database collections start with `staff_`, and all new endpoints start with `/api/staff`.

1. Configure `backend/.env` with your existing `MONGODB_URI` and a strong `JWT_SECRET` (or a separate `STAFF_JWT_SECRET`). Atlas must allow your backend computer's public IP. MongoDB transactions require a replica set; Atlas supports them.
2. Install backend dependencies if needed with `npm install` from `backend`.
3. Create the initial staff account and table layout **once**. This explicitly writes new staff records to the database named by `MONGODB_URI`; it does not modify customer records. Agree on using the shared cluster with its owner first. In PowerShell, from `backend`:

   ```powershell
   $env:STAFF_SEED_EMAIL = 'host@example.com'
   $env:STAFF_SEED_ID = 'host-001'
   $env:STAFF_SEED_NAME = 'Tharindu Silva'
   $staffPassword = Read-Host 'Choose a staff password (at least 10 characters)' -AsSecureString
   $env:STAFF_SEED_PASSWORD = [System.Net.NetworkCredential]::new('', $staffPassword).Password
   npm run staff:setup
   Remove-Item Env:STAFF_SEED_PASSWORD
   ```

   Setup creates Ember & Oak, one host account, and twelve available tables (nine Main Area, three Outdoor). Re-running preserves existing staff passwords and table states. No fictitious customers are inserted. Do not use your MongoDB database password as a staff login password.
4. Start the backend: `npm run dev` from `backend`.
5. Set `mobile/.env` to `EXPO_PUBLIC_API_URL=http://localhost:5000` for web, or `http://YOUR_COMPUTER_WIFI_IP:5000` for your phone. Keep the phone and computer on the same Wi-Fi; allow port 5000 through the computer firewall. An Expo tunnel does not tunnel your API.
6. From `mobile`, run `npx expo start --web --clear` (web) or `npx expo start --go --clear` (phone).
7. Open `/staff/login`, or use the existing Restaurant Staff tab. Sign in with the staff ID/email and the password you chose during setup.

## Screens and workflows

- Home: real profile, duty status, table counts, waiting parties, and estimated wait; Add Walk-in and New Reservation actions.
- Queue: search/filter; open an entry to edit, cancel, send an early/ready alert, or assign a table.
- Reservations: Today/Upcoming/Past filters; creation/editing, check-in, timed table holds, cancellation, and no-show management.
- Tables: Main Area/Outdoor and status filters; details, status updates, and history.
- Assignment: capacity-based available tables; atomic seating or reservation hold; successful changes open Table Updated.
- No-show: countdown, extend active hold by ten minutes, contact customer using the phone dialer, mark no-show. The backend releases expired holds every 15 seconds and after restart.
- More: profile, editable name/preferences, shift and duty state, activity, notifications, help, logout.

All protected API queries scope data to the authenticated account's restaurant. Staff JWTs have a distinct audience and server-side revocable sessions. Login is rate limited. Customer tokens cannot authenticate to staff routes. Staff login never overwrites customer tokens.

The current staff session token stays in memory and expires after eight hours. Reloading the browser or restarting Expo requires signing in again. Remember me retains only the identifier, never the password/token. Persistent mobile sign-in would require adding SecureStore; persistent web sign-in should use an HTTP-only cookie. Password resets are manager-assisted at this stage.

## Design and integration limits

The screens follow the report's staff flow, white cards, burgundy actions, color-coded status chips, table grid, fixed footer actions, confirmation screen, and bottom navigation. Supplementary customer-detail, reservation-form, shift, settings, history, and help screens fill navigation gaps in the report. Profile initials replace a hardcoded photograph. Table details use a neutral table hero instead of restaurant photography. Reservation date/time inputs are explicit text fields in Sri Lanka time, rather than a custom date picker.

The estimated wait is a documented heuristic: immediate service when there are no waiting parties and an available table; otherwise ten minutes per waiting batch based on available tables, with a five-minute minimum. It is not a learned forecast and does not account for dining-duration history yet.

Alert creation persists a message and updates queue status and staff notifications. It **does not send SMS or push notifications to customer devices**. The screen says Alert Recorded and explains this. Connecting a delivery provider/customer inbox is future integration, not a fake success.

Staff-created reservations and walk-ins currently live in `staff_parties`. They do not automatically include future customer portal bookings. A shared customer/staff data contract is required before bridging these, intentionally avoiding changes to the other portal.

## Verification

```powershell
# backend
npm run build
npm run test:staff

# mobile
npx tsc --noEmit
npx eslint app/staff src/components/staff src/services/staffAuth.ts src/services/staffData.ts
npx expo export --platform web --output-dir .expo/staff-portal-web-check
```

Export the web app before running `test:staff` to include browser tests. Tests start a disposable local MongoDB replica set and do not load `.env` or access Atlas. The first run downloads a MongoDB binary. Install the matching browser with `npx playwright install chromium` from `backend`; the check prefers Playwright Chromium and falls back to installed Edge on Windows.

The staff-only lint check passes. Full `npx expo lint` still reports three existing errors in customer `home.tsx` and `login.tsx`, which are outside this staff change.

Functional coverage: customer/anonymous access rejection, staff ID login, validation, idempotent saves/alerts, restaurant isolation, activity/read states, concurrent table assignment, cleaning transitions, hold extension/expiry/cancellation, preferences, account disabling, token revocation, and browser walk-in/assignment/logout navigation.

Report traceability: FR4 table updates/assignment; FR6 walk-in creation; FR10 timed hold release; FR11 early alerts recorded. End-to-end customer delivery for FR3/FR11 remains an integration limitation. Five-participant usability testing on the actual mobile app and report/viva evidence must be performed by the team.
