# Project Notes

This document explains how the check-in system is currently built, how to run it locally, and the architecture a developer should understand before making changes.

## Stack

- Framework: Next.js App Router with TypeScript
- App directory: `src/app`
- Styling: Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma 6
- Auth: magic links for students/mentors, PIN login for admins, and JWT httpOnly cookies
- Email: Resend
- Charts: Recharts
- Package manager: pnpm

This project started from a `create-next-app` skeleton. Do not reinitialize the app.

## Repository Architecture

The app is organized around Next.js App Router routes in `src/app`, with shared server utilities in root `lib`, React session state in `context`, and Prisma schema/migrations in `prisma`.

```text
src/app/
  page.tsx                         Public landing/status page
  layout.tsx                       Root layout and UserProvider
  login/page.tsx                   Magic-link sign-in for students and mentors
  guest/page.tsx                   Public guest check-in form
  dashboard/page.tsx               Student check-in dashboard
  mentor/page.tsx                  Mentor clock-in/out dashboard
  admin/layout.tsx                 Shared admin navigation and page-level gate
  admin/login/page.tsx             Admin email + PIN sign-in
  admin/overview/page.tsx          Admin overview dashboard
  admin/kiosk/page.tsx             Admin kiosk open/close control
  admin/guests/page.tsx            Admin guest visit history
  admin/students/page.tsx          Admin student records
  admin/mentors/page.tsx           Admin mentor records and hours
  admin/settings/page.tsx          Admin PIN settings
  admin/analytics/page.tsx         Admin analytics and mentor timesheets
  api/                             Route handlers

context/
  UserContext.tsx                  Client-side session restoration, login, logout

lib/
  auth.ts                          JWT sign/verify helpers
  magic-link.ts                    One-time login token helpers
  get-session.ts                   Server-side cookie-to-session helper
  require-admin.ts                 Admin session helper for API routes
  prisma.ts                        Prisma client singleton
  date-time.ts                     Shared app timezone utilities
  email.ts                         Resend notification helper
  admin-pin.ts                     Admin PIN hashing and verification
  db/bookings.ts                   Booking/check-in data access helpers
  db/shifts.ts                     Mentor shift data access helpers

prisma/
  schema.prisma                    Data model
  migrations/                      Database migrations
  seed.ts                          Local sample data
```

The important dependency direction is:

1. Client pages call API routes with `fetch(..., { credentials: "include" })`.
2. API routes call `getSession()` or `requireAdmin()` for authentication and authorization.
3. API routes call `lib/db/*` helpers or Prisma directly for database access.
4. Prisma uses PostgreSQL through `DATABASE_URL`.
5. Email notification is attempted after check-in but must never block a successful check-in response.

Each source file starts with a short `Purpose:` header. Keep those headers current when changing a file's responsibility.

## Route Architecture

Pages:

- `/`: public landing/status page
- `/login`: student/mentor magic-link sign-in page
- `/auth/verify`: magic-link verification page
- `/guest`: public guest check-in form
- `/dashboard`: student dashboard
- `/mentor`: mentor dashboard with shift clock-in/out and appointments
- `/admin/login`: admin email + PIN sign-in page
- `/admin/overview`: admin overview dashboard
- `/admin/kiosk`: admin kiosk open/close page
- `/admin/guests`: admin guest visit history
- `/admin/students`: admin student records and booking history
- `/admin/mentors`: admin mentor summaries, hours, and shift history
- `/admin/settings`: admin PIN settings
- `/admin/analytics`: admin analytics and mentor timesheet page

API routes:

- `GET /api/health`: public health check
- `POST /api/auth/request-link`: creates and emails a student/mentor magic link
- `POST /api/auth/verify-link`: verifies a magic link and creates a session
- `POST /api/auth/logout`: clears token cookie
- `GET /api/auth/me`: returns current session user
- `POST /api/guest`: records a public guest visit
- `GET /api/bookings`: returns confirmed bookings for the logged-in student
- `POST /api/bookings/[id]/checkin`: checks a student into a booking
- `GET /api/admin/kiosk`: public kiosk status for student dashboard gating
- `POST /api/admin/kiosk`: admin-only kiosk open/close
- `POST /api/admin/login`: admin email + PIN login
- `GET /api/admin/overview`: admin-only daily summary counts
- `GET /api/admin/guests`: admin-only guest visit records
- `GET /api/admin/students`: admin-only student records
- `GET /api/admin/mentors`: admin-only mentor records and totals
- `POST /api/admin/settings/pin`: admin-only PIN change
- `GET /api/admin/analytics/checkins`: admin-only check-in bucket data
- `GET /api/admin/analytics/mentors`: admin-only mentor shift data
- `GET /api/mentor/shift`: mentor-only active/recent shifts and completed hours
- `POST /api/mentor/shift`: mentor-only clock in/out
- `GET /api/mentor/appointments`: mentor-only appointments for today

`src/middleware.ts` protects `/dashboard/*`, `/mentor/*`, and `/admin/*` by requiring a valid token. Role and admin authorization are enforced in API routes and page-level client gates.

## Environment Variables

Use `.env.local.example` as the committed template and do not commit `.env`.

Required for local app behavior:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/checkin"
JWT_SECRET="development-secret"
```

Required for sending check-in emails:

```bash
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

Optional:

```bash
CHECKIN_NOTIFICATION_RECIPIENT="test-recipient@example.com"
```

If `CHECKIN_NOTIFICATION_RECIPIENT` is set, check-in emails are routed there instead of the mentor email. This is useful with seeded fake mentor emails. If Resend is not configured, the app logs a warning and skips email without failing check-in.

## Data Model

Prisma models:

- `User`
  - `role`: `student`, `mentor`, or `admin`
  - `mentorType`: `CONSULTATION` or `LAB` for mentors
- `MagicLinkToken`
  - stores one-time login tokens for student/mentor magic-link sign-in
  - tokens expire 15 minutes after creation and can only be used once
- `Guest`
  - standalone public guest visit log, separate from authenticated users
- `Timeslot`
  - belongs to a mentor
  - stores `date`, `startTime`, and `endTime`
- `Booking`
  - belongs to a student, mentor, and timeslot
  - status enum: `CONFIRMED`, `CANCELLED`, `COMPLETED`
- `Checkin`
  - one-to-one with `Booking`
  - unique `bookingId` prevents two check-ins for the same booking
- `KioskStatus`
  - singleton row with `id = "singleton"`
  - stores open/closed state and timestamps
- `AppSetting`
  - stores the salted admin PIN hash
- `Shift`
  - belongs to a mentor
  - records `clockInAt` and optional `clockOutAt`
  - database index enforces one active shift per mentor

Shared date/time logic lives in `lib/date-time.ts`. The app timezone is currently `America/Indiana/Indianapolis`.

## Authentication And Authorization

Authentication uses magic links for students and mentors, and email plus PIN for admins. There are no account passwords.

Student/mentor login flow:

1. User enters an email at `/login`.
2. `POST /api/auth/request-link` looks up the user by email and creates a one-time token.
3. The app emails a link to `/auth/verify?token=...`.
4. `POST /api/auth/verify-link` verifies and consumes the token.
5. The API signs a JWT using `JWT_SECRET`.
6. The JWT is stored in an httpOnly cookie named `token`.
7. `UserContext` calls `GET /api/auth/me` on mount to restore the session.
8. Magic-link login redirects mentors to `/mentor` and students to `/dashboard`.

Admin login flow:

1. Admin enters email and PIN at `/admin/login`.
2. `POST /api/admin/login` verifies the user has `role === "admin"`.
3. The API verifies the submitted PIN against the salted hash in `AppSetting`.
4. The API signs a JWT and stores it in the `token` cookie.
5. The admin login page updates `UserContext` immediately before navigating to `/admin/overview`.

Server-side helpers:

- `lib/auth.ts`: signs and verifies JWTs with an 8-hour expiration
- `lib/magic-link.ts`: creates and redeems one-time login tokens
- `lib/get-session.ts`: reads the `token` cookie and verifies it
- `lib/require-admin.ts`: returns the session only when `role === "admin"`
- `lib/admin-pin.ts`: verifies and updates the shared admin PIN

Security boundaries:

- Student booking APIs require a valid session and only return or mutate records for `session.userId`.
- Mentor APIs require `session.role === "mentor"`.
- Admin mutating, settings, and analytics APIs require `requireAdmin()`.
- Admin pages also show a page-level no-access state for non-admin users.

## Check-In Flow

When a student clicks "Check In":

1. The dashboard POSTs to `/api/bookings/[id]/checkin`.
2. The API checks for a valid session.
3. The API checks that the kiosk is open.
4. The API loads the booking with mentor, student, timeslot, and checkin.
5. The API rejects:
   - missing session with `401`
   - closed kiosk with `403`
   - missing booking with `404`
   - wrong student with `403`
   - already checked in with `400`
   - non-confirmed booking with `400`
6. The API creates the `Checkin`.
7. The API attempts to send a Resend email.
8. Email errors are logged but do not fail the check-in response.

The database also enforces one check-in per booking with a unique `bookingId` constraint.

## Mentor Shift Flow

Mentors use `/mentor` to clock in and out.

- `GET /api/mentor/shift` returns `{ activeShift, recentShifts, completedShiftHours }`.
- `POST /api/mentor/shift` accepts `{ action: "clock_in" | "clock_out" }`.
- `lib/db/shifts.ts` guards state transitions and maps expected invalid states to clean `400` responses.
- A database partial unique index prevents more than one active shift for the same mentor.
- The mentor dashboard displays total hours worked by combining completed shift hours from the API with the live active shift duration.

## Admin Features

Admins are users with `role === "admin"` and authenticate with email plus the shared admin PIN.

Admin kiosk:

- `GET /api/admin/kiosk` is public so student dashboards can know whether check-in is open.
- `POST /api/admin/kiosk` requires admin.
- The kiosk state is a singleton row with `id = "singleton"`.

Admin analytics:

- Check-in analytics support `range=day|week|month`.
- Mentor analytics return the latest shifts across mentors.
- The chart UI uses Recharts.

Admin settings:

- Admins can change the shared PIN from `/admin/settings`.
- The API requires the current PIN before writing a new salted hash.

## Database

The local database is PostgreSQL. A common local Docker container name has been:

```bash
checkin-db
```

Start it with:

```bash
docker start checkin-db
```

Run migrations:

```bash
npx prisma migrate dev
```

Seed test data:

```bash
npx prisma db seed
```

Open Prisma Studio:

```bash
npx prisma studio
```

The seed creates:

- 3 mentors
- 5 students
- 1 admin user
- 1 kiosk singleton row
- 6 timeslots
- 6 confirmed bookings
- sample historical mentor shifts

The seed uses `upsert` for users and the kiosk singleton, and it clears/recreates seeded bookings, timeslots, check-ins, and shifts for seeded users.

## Development Commands

Install dependencies:

```bash
pnpm install
```

Start dev server:

```bash
pnpm dev
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Run lint:

```bash
npm run lint
```

Run Prisma generate:

```bash
npx prisma generate
```

Check migration status:

```bash
npx prisma migrate status
```

## Known Notes

- The project uses pnpm. `npm install` previously caused issues with the existing pnpm workspace layout.
- Prisma is pinned to version 6 because the current schema uses the Prisma 6 datasource `url = env("DATABASE_URL")` format.
- Next 16 warns that `middleware` is deprecated in favor of `proxy`, but `src/middleware.ts` is currently working for route protection.
- Production builds may need network access for `next/font` Google font fetching unless fonts are changed or self-hosted.
- Prisma currently warns that `package.json#prisma` seed config is deprecated for Prisma 7; this is not blocking in Prisma 6.
