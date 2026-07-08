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

Run the Prisma migrations and generate the Prisma client:

```bash
npx prisma migrate dev
npx prisma generate
```

The migrations create the app tables and constraints defined in `prisma/schema.prisma`.

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

npx prisma studio
npx prisma generate
pnpm list prisma @prisma/client
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint \
context/UserContext.tsx \
src/app/api/auth/me/route.ts \
src/app/login/page.tsx \
src/app/dashboard/page.tsx \
src/app/layout.tsx \
src/app/page.tsx

./node_modules/.bin/next dev --port 3000
npm run dev

node -e 'const { PrismaClient } = require("@prisma/client"); const prisma = new PrismaClient(); prisma.checkin.deleteMany().then((result) => console.log(JSON.stringify(result))).finally(() => prisma.$disconnect());
./node_modules/.bin/eslint lib/email.ts 'src/app/api/bookings/[id]/checkin/route.ts

curl -s -c /tmp/checkin-cookies.txt -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"student1@purdue.edu"}' && printf '\n' && curl -i -b /tmp/checkin-cookies.txt -X POST http://localhost:3000/api/bookings/cmqb4u29s000vy7d9nb9349pr/checkin

