# Kiosk App — Local Setup Guide

This guide walks through running the Kiosk App on a local computer for the first time. Complete the steps in order. For architecture and development details, see `PROJECT_NOTES.md`.

## 1. Install the required software

Install:

- Git
- Node.js 20 or newer
- pnpm
- PostgreSQL, unless you are using a hosted Neon database
- Access to the separate OS4 PostgreSQL database
- A Resend account for sending login codes and notifications

Confirm that Git and Node.js are available:

```bash
git --version
node --version
```

Enable pnpm through Node's Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

## 2. Download the project

Clone the repository and enter its directory:

```bash
git clone https://github.com/malakahmedsaad/check-in-system.git
cd check-in-system
```

If the repository has already been cloned, update it instead:

```bash
git checkout main
git pull origin main
```

## 3. Install dependencies

Run:

```bash
pnpm install
```

Use pnpm rather than npm because the repository contains `pnpm-lock.yaml`.

## 4. Prepare the kiosk database

The kiosk database stores OTP codes, guest visits, kiosk status, the admin PIN hash, mentor shifts, and check-ins.

You can use either:

- A hosted PostgreSQL database such as Neon.
- A local PostgreSQL database.

For Neon, create a PostgreSQL project and copy its connection string from the Neon dashboard.

For a local PostgreSQL installation, create an empty database:

```bash
createdb checkin
```

A typical local connection URL looks like:

```text
postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/checkin
```

Do not copy that example literally. Replace the username and password with your PostgreSQL credentials.

## 5. Prepare the OS4 database connection

The app does not create or migrate the OS4 database. OS4 is a separate project containing users, roles, appointments, and timeslots.

Before continuing:

1. Obtain the OS4 PostgreSQL connection details from the OS4 team.
2. Ask for a dedicated read-only database user.
3. If OS4 runs in Docker locally, start the OS4 project and confirm its database container is running.
4. Confirm that the OS4 database is reachable from this computer.

Do not run kiosk migrations against OS4.

## 6. Create the environment file

On macOS or Linux:

```bash
cp .env.local.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env
```

Open `.env` in a text editor and replace every required placeholder.

At minimum, configure:

```dotenv
DATABASE_URL="<kiosk-database-connection-url>"
OS4_DATABASE_URL="<read-only-os4-database-connection-url>"
JWT_SECRET="<random-secret-at-least-32-characters>"
ADMIN_PIN="<secure-numeric-pin>"
RESEND_API_KEY="<resend-api-key>"
RESEND_FROM_EMAIL="<verified-sender-address>"
```

Generate a suitable JWT secret with:

```bash
openssl rand -base64 48
```

Optional email overrides:

```dotenv
CHECKIN_NOTIFICATION_RECIPIENT=
OTP_NOTIFICATION_RECIPIENT=
```

During testing, place a controlled email address after `=` to redirect messages. Leave the values empty when emails should go to the actual OS4 users.

Next.js normally sets `NODE_ENV` automatically. Do not set it manually unless your runtime specifically requires it.

Never commit `.env`.

## 7. Generate both Prisma clients

The app needs one Prisma client for the kiosk database and one for the read-only OS4 database.

Run:

```bash
npm run prisma:generate:all
```

This command generates:

1. The normal kiosk client from `prisma/schema.prisma`.
2. The OS4 client from `prisma-os4/schema.prisma`.

If this step reports a missing environment variable, return to Step 6 and check `.env`.

## 8. Apply kiosk database migrations

Run:

```bash
npx prisma migrate deploy
```

This applies the committed migrations to `DATABASE_URL`.

Check the result:

```bash
npx prisma migrate status
```

The status should report that the kiosk database schema is up to date.

Do not add `--schema=prisma-os4/schema.prisma` to either migration command.

## 9. Seed required kiosk records

Run:

```bash
npx prisma db seed
```

The seed:

- Creates the singleton kiosk-status record if it does not exist.
- Creates the initial salted admin PIN record using `ADMIN_PIN`.

It does not create OS4 users, appointments, mentors, or timeslots.

## 10. Start the development server

Run:

```bash
pnpm dev
```

Wait until the terminal reports:

```text
Local: http://localhost:3000
```

Keep this terminal open while using the app.

## 11. Verify both database connections

Open a second terminal in the project directory and run:

```bash
curl http://localhost:3000/api/health
```

On Windows PowerShell, use:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

A fully working installation returns:

```json
{
  "status": "ok",
  "kiosk_db": "ok",
  "os4_db": "ok",
  "timestamp": "..."
}
```

If the status is `degraded` or `down`, resolve the database error before testing login or appointment flows.

## 12. Open and test the app

Open [http://localhost:3000](http://localhost:3000) in a browser.

Check these pages:

1. `/` displays the kiosk landing page.
2. `/guest` displays the guest questionnaire.
3. `/login` displays the student and peer-mentor OTP form.
4. `/admin/login` displays the staff email and PIN form.

To test student or mentor login, use an email that already exists in the OS4 database. The OTP is sent through Resend or to `OTP_NOTIFICATION_RECIPIENT` when that override is set.

To test staff login:

1. Use an OS4 user whose role is `ADMIN` or `SUPERVISOR`.
2. Enter the PIN configured through `ADMIN_PIN` during seeding.
3. After signing in, the app should open `/admin/overview`.

## 13. Run verification checks

Before considering the local setup complete, run:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

All three commands should exit successfully.

The Next.js build currently prints a warning that the `middleware` convention is deprecated. That warning is known and does not prevent the build from succeeding.

## 14. Stop and restart the app

Stop the development server by pressing:

```text
Ctrl+C
```

For later sessions, the normal startup process is:

```bash
cd check-in-system
pnpm install
pnpm dev
```

You do not need to rerun migrations or seeding every time. Run migrations after pulling commits that contain new files under `prisma/migrations`.

## Database inspection

To inspect the kiosk database:

```bash
npx prisma studio
```

To inspect OS4 through the read-only schema:

```bash
npx prisma studio --schema=prisma-os4/schema.prisma
```

Prisma Studio opens in a browser. Do not edit OS4 records through this project.

## Troubleshooting

### The kiosk database does not connect

- Check `DATABASE_URL`.
- Confirm PostgreSQL or the Neon project is running.
- Confirm network access and SSL settings required by the provider.
- Run `npx prisma migrate status`.

### The OS4 database does not connect

- Check `OS4_DATABASE_URL`.
- Confirm the OS4 project or Docker container is running.
- Confirm the read-only user can connect.
- Regenerate the OS4 client with `npm run prisma:generate:os4`.

### Prisma types or generated clients are missing

Run:

```bash
npm run prisma:generate:all
```

Then restart the development server.

### OTP or notification emails do not arrive

- Check `RESEND_API_KEY`.
- Confirm `RESEND_FROM_EMAIL` is verified in Resend.
- Check the Resend delivery logs.
- During development, set the appropriate test-recipient override.

### Admin login fails

- Confirm the email belongs to an OS4 `ADMIN` or `SUPERVISOR`.
- Confirm the kiosk database was seeded.
- Confirm the PIN matches the value used when the `AppSetting` record was first created.
- If an admin later changed the PIN in Settings, use that newer PIN instead of the `.env` value.

## Contact

Built by: Malak Ahmed Saad  
Repository: [https://github.com/malakahmedsaad/check-in-system](https://github.com/malakahmedsaad/check-in-system)
