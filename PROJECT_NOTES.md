# Project Notes

This document explains how the check-in system is currently built, how to run it locally, and the architecture a developer should understand before making changes.

## Stack

- Framework: Next.js App Router with TypeScript
- App directory: `src/app`
- Styling: Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma 6
- Auth: email-only login with JWT httpOnly cookies
- Email: Resend
- Charts: Recharts
- Package manager: pnpm

This project started from a `create-next-app` skeleton. Do not reinitialize the app.

## Repository Architecture

The app is organized around Next.js App Router routes in `src/app`, with shared server utilities in root `lib`, React session state in `context`, and Prisma schema/migrations in `prisma`.

```text
src/app/
  page.tsx                         Redirects to /login
  layout.tsx                       Root layout and UserProvider
  login/page.tsx                   Email-only sign-in
  dashboard/page.tsx               Student check-in dashboard
  mentor/page.tsx                  Mentor clock-in/out dashboard
  admin/layout.tsx                 Shared admin navigation and page-level gate
  admin/kiosk/page.tsx             Admin kiosk open/close control
  admin/analytics/page.tsx         Admin analytics and mentor timesheets
  api/                             Route handlers

context/
  UserContext.tsx                  Client-side session restoration, login, logout

lib/
  auth.ts                          JWT sign/verify helpers
  get-session.ts                   Server-side cookie-to-session helper
  require-admin.ts                 Admin session helper for API routes
  prisma.ts                        Prisma client singleton
  date-time.ts                     Shared app timezone utilities
  email.ts                         Resend notification helper
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

## Route Architecture

Pages:

- `/`: redirects to `/login`
- `/login`: email sign-in page
- `/dashboard`: student dashboard
- `/mentor`: mentor dashboard with shift clock-in/out and appointments
- `/admin/kiosk`: admin kiosk open/close page
- `/admin/analytics`: admin analytics and mentor timesheet page

API routes:

- `GET /api/health`: public health check
- `POST /api/auth/login`: email login
- `POST /api/auth/logout`: clears token cookie
- `GET /api/auth/me`: returns current session user
- `GET /api/bookings`: returns confirmed bookings for the logged-in student
- `POST /api/bookings/[id]/checkin`: checks a student into a booking
- `GET /api/admin/kiosk`: public kiosk status for student dashboard gating
- `POST /api/admin/kiosk`: admin-only kiosk open/close
- `GET /api/admin/analytics/checkins`: admin-only check-in bucket data
- `GET /api/admin/analytics/mentors`: admin-only mentor shift data
- `GET /api/mentor/shift`: mentor-only active/recent shifts
- `POST /api/mentor/shift`: mentor-only clock in/out
- `GET /api/mentor/appointments`: mentor-only appointments for today

`src/middleware.ts` protects `/dashboard/*`, `/mentor/*`, and `/admin/*` by requiring a valid token. Role and admin authorization are enforced in API routes and page-level client gates.

## Environment Variables

Use `.env.local.example` as the committed template and do not commit `.env.local`.

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
  - `role`: `student` or `mentor`
  - `isAdmin`: independent admin flag
  - `mentorType`: `CONSULTATION` or `LAB` for mentors
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
- `Shift`
  - belongs to a mentor
  - records `clockInAt` and optional `clockOutAt`
  - database index enforces one active shift per mentor

Shared date/time logic lives in `lib/date-time.ts`. The app timezone is currently `America/Indiana/Indianapolis`.

## Authentication And Authorization

Authentication is email-only. There are no passwords.

Login flow:

1. User enters an email at `/login`.
2. `POST /api/auth/login` looks up the user by email.
3. If found, the API signs a JWT using `JWT_SECRET`.
4. The JWT is stored in an httpOnly cookie named `token`.
5. `UserContext` calls `GET /api/auth/me` on mount to restore the session.
6. Login redirects admins to `/admin/kiosk`, mentors to `/mentor`, and students to `/dashboard`.

Server-side helpers:

- `lib/auth.ts`: signs and verifies JWTs with an 8-hour expiration
- `lib/get-session.ts`: reads the `token` cookie and verifies it
- `lib/require-admin.ts`: returns the session only when `isAdmin` is true

Security boundaries:

- Student booking APIs require a valid session and only return or mutate records for `session.userId`.
- Mentor APIs require `session.role === "mentor"`.
- Admin mutating and analytics APIs require `requireAdmin()`.
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

- `GET /api/mentor/shift` returns `{ activeShift, recentShifts }`.
- `POST /api/mentor/shift` accepts `{ action: "clock_in" | "clock_out" }`.
- `lib/db/shifts.ts` guards state transitions and maps expected invalid states to clean `400` responses.
- A database partial unique index prevents more than one active shift for the same mentor.

## Admin Features

Admins are regular users with `isAdmin: true`.

Admin kiosk:

- `GET /api/admin/kiosk` is public so student dashboards can know whether check-in is open.
- `POST /api/admin/kiosk` requires admin.
- The kiosk state is a singleton row with `id = "singleton"`.

Admin analytics:

- Check-in analytics support `range=day|week|month`.
- Mentor analytics return the latest shifts across mentors.
- The chart UI uses Recharts.

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
- 1 admin mentor
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
