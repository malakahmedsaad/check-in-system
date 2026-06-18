# Project Notes

This document explains how the student appointment check-in app is currently built, how to run it locally, and the important implementation details a developer should know before making changes.

## Stack

- Framework: Next.js App Router with TypeScript
- App directory: `src/app`
- Styling: Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma 6
- Auth: Email-only login with JWT cookies
- Email: Resend
- Package manager: pnpm

This project started from a `create-next-app` skeleton. Do not reinitialize the app.

## Important Directories

- `src/app`: Next.js pages, layouts, and API routes
- `context/UserContext.tsx`: client-side user/session provider
- `lib/prisma.ts`: Prisma singleton
- `lib/auth.ts`: JWT sign/verify helpers
- `lib/get-session.ts`: server-side cookie session helper for API routes
- `lib/db/bookings.ts`: Prisma booking/check-in query functions
- `lib/email.ts`: Resend check-in email helper
- `prisma/schema.prisma`: Prisma data model
- `prisma/seed.ts`: test data seed script
- `src/middleware.ts`: route protection for `/dashboard`

## Environment Variables

The app expects these variables:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/checkin"
JWT_SECRET="development-secret"
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

Use `.env.local.example` as the committed template. 

For Resend free/test mode, `RESEND_FROM_EMAIL` should be `onboarding@resend.dev` unless a real domain has been verified in Resend. If a Gmail address is used as the sender, Resend rejects it because `gmail.com` is not a verified sending domain.

## Database

The local database is PostgreSQL running in Docker. The existing local container name has been:

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
- 6 timeslots
- 6 confirmed bookings

The seed uses `upsert` for users, but it clears and recreates seeded bookings/timeslots for the test users.

To reset all check-ins locally:

```bash
node -e 'const { PrismaClient } = require("@prisma/client"); const prisma = new PrismaClient(); prisma.checkin.deleteMany().then(console.log).finally(() => prisma.$disconnect());'
```

## Data Model

Prisma models:

- `User`
  - roles: `student`, `mentor`
  - mentors may have `mentorType`: `CONSULTATION` or `LAB`
- `Timeslot`
  - belongs to a mentor
  - stores `date`, `startTime`, `endTime`
- `Booking`
  - belongs to a student, mentor, and timeslot
  - status enum: `CONFIRMED`, `CANCELLED`, `COMPLETED`
- `Checkin`
  - one-to-one with a booking
  - created when a student checks in

## Authentication

Authentication is email-only. There are no passwords.

Login flow:

1. Student enters an email at `/login`.
2. `POST /api/auth/login` looks up the user by email.
3. If found, the API signs a JWT using `JWT_SECRET`.
4. The JWT is stored in an httpOnly cookie named `token`.
5. `UserContext` calls `GET /api/auth/me` on mount to restore the session.

Relevant files:

- `lib/auth.ts`
- `lib/get-session.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `context/UserContext.tsx`

`src/middleware.ts` protects `/dashboard` by checking the `token` cookie. Middleware must stay under `src/` for this project layout.

## Main Routes

Pages:

- `/`: redirects to `/login`
- `/login`: email sign-in page
- `/dashboard`: student dashboard

API routes:

- `GET /api/health`: public health check
- `POST /api/auth/login`: email login
- `POST /api/auth/logout`: clears token cookie
- `GET /api/auth/me`: returns current session user
- `GET /api/bookings`: returns confirmed bookings for the logged-in student
- `POST /api/bookings/[id]/checkin`: creates a check-in for a booking

## Student Dashboard

The dashboard is a client component at `src/app/dashboard/page.tsx`.

It:

- fetches `GET /api/bookings` with `credentials: "include"`
- shows loading skeleton cards
- shows an empty state when no bookings exist
- renders appointment cards
- lets students check in without a page reload
- updates the checked-in card locally after a successful check-in

## Check-In Flow

When a student clicks "Check In":

1. The dashboard POSTs to `/api/bookings/[id]/checkin`.
2. The API checks for a valid session.
3. The API loads the booking with mentor, student, timeslot, and checkin.
4. The API rejects:
   - missing session with `401`
   - missing booking with `404`
   - wrong student with `403`
   - already checked in with `400`
   - non-confirmed booking with `400`
5. The API creates the `Checkin`.
6. The API attempts to send a Resend email.
7. Email errors are logged but do not fail the check-in response.

## Email Notifications

Email helper: `lib/email.ts`

Current temporary behavior:

- Email content still references the real mentor and student names.
- The recipient is hardcoded to `malkahmedsaad2005@gmail.com`.
- This is temporary because seeded mentor emails like `mentor1@purdue.edu` are fake.

The helper logs:

- email attempt recipient
- subject
- timestamp
- Resend error object if rejected
- Resend email id if accepted

If Resend rejects the email because of sender verification, use:

```bash
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

until a real sending domain is verified in the Resend dashboard.

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
./node_modules/.bin/tsc --noEmit
```

Run lint:

```bash
./node_modules/.bin/eslint
```

Run Prisma generate:

```bash
npx prisma generate
```

## Known Notes

- The project uses pnpm. `npm install` previously caused issues with the existing pnpm workspace layout.
- Prisma is pinned to version 6 because the current schema uses the Prisma 6 datasource `url = env("DATABASE_URL")` format.
- The older files under `src/lib` were created early for direct `pg` setup. The current app code uses Prisma via root `lib/`.
- Next 16 warns that `middleware` is deprecated in favor of `proxy`, but `src/middleware.ts` is currently working for route protection.
- Production builds may need network access for `next/font` Google font fetching unless fonts are changed or self-hosted.
