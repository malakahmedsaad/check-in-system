# Kiosk App — Project Notes

This document explains how the kiosk application is designed, how its main workflows operate, and why key implementation decisions were made. For installation and local startup instructions, use `HANDOFF.md`. Environment variable details live in `.env.local.example`.

## Purpose and users

The application supports daily check-in operations at the Bechtel Center for Innovation and Design:

- Students authenticate with their OS4 email and check in to confirmed appointments.
- Peer mentors authenticate with their OS4 email, clock in or out, and view the day's appointments.
- Staff authenticate with an OS4 admin or supervisor email plus the shared kiosk PIN, then manage kiosk activity and reporting.
- Guests do not authenticate; they submit a visit questionnaire.

The app owns kiosk-specific operational data. It does not own the OS4 user or appointment system.

## Architecture

The project uses the Next.js App Router with TypeScript. Pages and route handlers live in `src/app`, shared server logic lives in `lib`, client session state lives in `context`, and the database schemas live in `prisma` and `prisma-os4`.

```text
src/app/
  page.tsx                         Public kiosk landing/status page
  error.tsx                        Application error fallback
  not-found.tsx                    Branded 404 page
  login/page.tsx                   Student and mentor OTP sign-in
  guest/page.tsx                   Public guest questionnaire
  dashboard/page.tsx               Student appointment dashboard
  mentor/page.tsx                  Mentor schedule and time clock
  admin/                           Staff pages and shared admin layout
  api/                             HTTP route handlers

context/
  UserContext.tsx                  Client session restoration and logout

lib/
  auth.ts                          JWT signing and verification
  otp.ts                           OTP generation and verification
  email.ts                         Resend delivery
  get-session.ts                   Cookie-to-session lookup
  require-admin.ts                 Admin authorization helper
  admin-pin.ts                     Admin PIN hashing and verification
  prisma.ts                        Kiosk Prisma client
  os4-prisma.ts                    Read-only OS4 Prisma client
  os4-role.ts                      OS4-to-kiosk role translation
  date-time.ts                     Application timezone calculations
  csv.ts                           CSV serialization
  db/bookings.ts                   Cross-database booking/check-in access
  db/shifts.ts                     Cross-database mentor/shift access
  db/join.ts                       Bulk OS4 enrichment for exports

prisma/
  schema.prisma                    Kiosk-owned data model
  migrations/                      Kiosk database migrations
  seed.ts                          Kiosk singleton and admin PIN seed

prisma-os4/
  schema.prisma                    Read-only mirror of relevant OS4 models
```

The main dependency direction is:

1. Client pages call route handlers.
2. Protected handlers validate the JWT session and required role.
3. Handlers call shared database helpers or one of the two Prisma clients.
4. Kiosk records are read from or written to the kiosk database.
5. User, role, appointment, and timeslot data is read from OS4.
6. Responses combine the data needed by the UI.

Keep the short `Purpose:` header at the top of source files current when their responsibility changes.

## Two-database design

The application deliberately uses two independent PostgreSQL connections.

### Kiosk database

`lib/prisma.ts` uses `DATABASE_URL`. This database is owned by this project and may be migrated by this repository.

It stores:

- `OtpCode`: short-lived email verification codes, failed-attempt count, and use state.
- `Guest`: public guest visit records.
- `KioskStatus`: the singleton open/closed state.
- `AppSetting`: the salted admin PIN hash.
- `Shift`: mentor clock-in/out records keyed by the OS4 mentor ID.
- `Checkin`: appointment check-ins keyed by the OS4 booking ID.

### OS4 database

`lib/os4-prisma.ts` uses `OS4_DATABASE_URL`. The schema in `prisma-os4/schema.prisma` mirrors only the OS4 models required by this app:

- `User`
- `Booking`
- `TimeSlot`
- OS4 role and booking-status enums

The OS4 client must remain read-only. Do not run migrations against the OS4 schema and do not add create, update, delete, or upsert operations through `os4Prisma`. Schema changes must be coordinated with the OS4 team.

### Cross-database relations

PostgreSQL cannot enforce foreign keys across the two projects, so cross-database relationships are application-level:

- `Checkin.bookingId` refers to an OS4 `Booking.id`.
- `Shift.mentorId` refers to an OS4 `User.id`.
- `legacyMentorId` preserves an older local user identifier for migrated historical shifts.

`lib/db/bookings.ts` and `lib/db/shifts.ts` handle operational joins. `lib/db/join.ts` performs bulk enrichment for CSV exports. Missing OS4 records must be handled safely because the kiosk database cannot guarantee that referenced OS4 records still exist.

## Roles and authorization

`lib/os4-role.ts` translates OS4 roles:

| OS4 role | Kiosk role |
|---|---|
| `MEMBER` | `student` |
| `PEER_MENTOR` | `mentor` |
| `ADMIN` | `admin` |
| `SUPERVISOR` | `admin` |

Authentication uses a JWT stored in an HTTP-only `token` cookie. Tokens expire after eight hours.

`src/middleware.ts` redirects unauthenticated users and users with the wrong role:

- `/dashboard/*` requires `student`.
- `/mentor/*` requires `mentor`.
- `/admin/*` requires `admin`, except the staff login page.

Middleware is only the first boundary. API routes must still enforce ownership and roles using `getSession()` or `requireAdmin()`.

## Authentication workflows

### Student and mentor OTP

1. The user enters an email at `/login`.
2. `POST /api/auth/request-otp` looks up the email in OS4.
3. Admin and supervisor accounts are directed to the staff login.
4. A four-digit code is generated and stored in the kiosk `OtpCode` table.
5. Resend delivers the code to the user, or to `OTP_NOTIFICATION_RECIPIENT` when a test override is configured.
6. `POST /api/auth/verify-otp` validates and consumes the code.
7. The OS4 role is translated and placed in the signed JWT.
8. Students go to `/dashboard`; mentors go to `/mentor`.

OTP codes expire after ten minutes, are single-use, and lock after five incorrect attempts.

### Admin login

1. Staff enter their OS4 email and kiosk PIN at `/admin/login`.
2. `POST /api/admin/login` confirms the OS4 user is an admin or supervisor.
3. The submitted PIN is checked against the salted hash in `AppSetting`.
4. A JWT with the `admin` role is stored in the session cookie.
5. The user is sent to `/admin/overview`.

`ADMIN_PIN` is used only when the settings record does not yet exist and during initial seeding. Admins can change the stored PIN under Settings.

## Student check-in workflow

1. `/dashboard` loads confirmed OS4 bookings for the signed-in student.
2. Kiosk check-in records are attached from the kiosk database.
3. The client submits `POST /api/bookings/[id]/checkin`.
4. The handler verifies the session, kiosk state, booking ownership, booking status, check-in window, and duplicate state.
5. The kiosk database creates a unique `Checkin` record.
6. A mentor notification is sent through Resend.

The check-in succeeds even if the notification later fails. A unique database constraint on `bookingId` prevents duplicate check-ins during concurrent requests.

## Mentor shift workflow

Mentors use `/mentor` to see today's appointments and manage their shift.

- `GET /api/mentor/shift` returns the active shift, recent completed shifts, and completed hours.
- `POST /api/mentor/shift` accepts `clock_in` or `clock_out`.
- `lib/db/shifts.ts` validates state transitions.
- A partial unique database index prevents more than one active shift for a mentor.
- The UI combines completed hours with the live duration of an active shift.

Staff can inspect, correct, force-clock-out, or remove shifts through the admin routes.

## Admin features

The admin area includes:

- Overview counts for guests, student check-ins, and active mentors.
- Check-in analytics grouped by day, week, or month.
- Guest, student, mentor, and front-desk check-in views.
- Kiosk open/close controls protected by the admin PIN.
- Mentor shift correction and force-clock-out tools.
- Admin PIN changes.
- CSV exports for check-ins and timesheets.

Check-in exports accept optional `from` and `to` date keys in `YYYY-MM-DD` format. Timesheet exports accept an optional numeric `mentorId`. Both endpoints require an admin session and enrich kiosk records with OS4 data before generating CSV.

## Route map

### Public and user routes

- `GET /api/health`: checks both database connections and reports `ok`, `degraded`, or `down`.
- `POST /api/auth/request-otp`: sends a student or mentor OTP.
- `POST /api/auth/verify-otp`: verifies an OTP and starts a session.
- `POST /api/auth/logout`: clears the session cookie.
- `GET /api/auth/me`: returns the current session.
- `POST /api/guest`: records a guest visit.
- `GET /api/bookings`: returns the student's confirmed bookings.
- `POST /api/bookings/[id]/checkin`: checks the student into a booking.
- `GET|POST /api/mentor/shift`: reads or changes mentor shift state.
- `GET /api/mentor/appointments`: returns today's mentor appointments.

### Admin routes

- `GET|POST /api/admin/kiosk`: reads or changes kiosk state.
- `POST /api/admin/login`: authenticates staff.
- `GET /api/admin/overview`: returns dashboard summary counts.
- `GET /api/admin/guests`: returns guest history.
- `GET /api/admin/students`: returns student and booking summaries.
- `GET /api/admin/mentors`: returns mentor and hour summaries.
- `GET|POST /api/admin/checkin`: supports front-desk check-in.
- `POST /api/admin/settings/pin`: changes the shared PIN.
- `GET /api/admin/analytics/checkins`: returns chart buckets.
- `GET /api/admin/analytics/mentors`: returns recent mentor shifts.
- `GET /api/admin/shifts`: lists shifts or returns current mentor shift status.
- `PATCH|DELETE /api/admin/shifts/[id]`: corrects or removes a shift.
- `POST /api/admin/shifts/clockout`: force-clocks out a mentor.
- `GET /api/admin/export/checkins`: downloads check-ins as CSV.
- `GET /api/admin/export/timesheets`: downloads shifts as CSV.

## Error and degraded-state behavior

- `src/app/error.tsx` provides a retryable fallback for unhandled React errors.
- `src/app/not-found.tsx` provides the branded 404 page.
- The landing page displays a retryable system-unavailable state when kiosk status cannot be loaded.
- `/api/health` catches individual database failures and never treats one failed connection as a successful full-health result.
- Expected authentication, validation, and state errors return structured JSON rather than framework error pages.

## Date and time handling

The application timezone is `America/Indiana/Indianapolis`. Shared day boundaries and date keys come from `lib/date-time.ts`; do not replace them with server-local date calculations. This matters for analytics, check-in windows, exports, and "today" queries around UTC midnight and daylight-saving transitions.

## Development process

When changing the application:

1. Identify which database owns the affected data.
2. Put reusable database access in `lib/db` rather than duplicating cross-database joins in routes.
3. Keep OS4 access read-only.
4. Enforce authentication and ownership in the API, even when middleware already protects the page.
5. Keep email delivery from invalidating an otherwise successful check-in.
6. Update `.env.local.example` when configuration changes.
7. Update this document when architecture or workflows change.
8. Run TypeScript, ESLint, and a production build before handoff.

The standard verification commands are:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

For changes to user flows, also run the app and verify the affected routes and redirects in a browser.

## Known limitations and follow-up work

- Expired `OtpCode` records are not deleted automatically. Add a scheduled cleanup for expired records older than the chosen retention period.
- Local development currently depends on the OS4 database being available separately.
- Test-recipient email overrides must be cleared before production delivery.
- The OS4 schema mirror must be updated manually when relevant OS4 models change.
- Next.js warns that the `middleware` convention is deprecated in favor of `proxy`; route protection currently works but should be migrated.
- Dependency advisories should be reviewed before each production deployment.
