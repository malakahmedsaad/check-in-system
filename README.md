# Student Appointment Check-In

This project is a Next.js App Router application for student appointment check-in workflows.

## Setup

Install dependencies:

```bash
pnpm install
```

Create a local environment file from the committed example:

```bash
cp .env.local.example .env.local
```

Configure `.env.local` with your local values:

```bash
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DATABASE_NAME
JWT_SECRET=your-local-secret
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=appointments@example.com
```

Do not commit `.env.local`.

## PostgreSQL

Create a PostgreSQL database for the app, then set `DATABASE_URL` to point at it.

Run the schema:

```bash
psql "$DATABASE_URL" -f src/lib/schema.sql
```

The schema creates the `users`, `timeslots`, `bookings`, and `checkins` tables.

## Resend

Create a Resend API key and add it to `RESEND_API_KEY` in `.env.local`.

Set `RESEND_FROM_EMAIL` to a verified sender address or domain configured in Resend.

## Development

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

used commands:

