# Kiosk App — Local Setup and Handoff

This guide is for someone who wants to run the project on their own device. For architecture, workflows, and development decisions, see `PROJECT_NOTES.md`.

## Prerequisites

- Node.js compatible with Next.js 16
- pnpm
- A writable kiosk PostgreSQL database
- Read-only access to the OS4 PostgreSQL database
- A Resend account with a verified sender

## Get the project

```bash
git clone https://github.com/malakahmedsaad/check-in-system.git
cd check-in-system
pnpm install
```

The repository uses `pnpm-lock.yaml`; use pnpm so dependency resolution matches the committed lockfile.

## Configure the environment

Copy the committed template:

```bash
cp .env.local.example .env
```

Fill in every required value in `.env`. The template explains where each value comes from and its expected format.

The two database URLs serve different purposes:

- `DATABASE_URL` connects to the kiosk database, which this app owns and migrates.
- `OS4_DATABASE_URL` connects to the separate OS4 database and must use read-only credentials.

For local testing, `CHECKIN_NOTIFICATION_RECIPIENT` and `OTP_NOTIFICATION_RECIPIENT` can redirect messages to controlled inboxes. Leave both empty when messages should go to their real recipients.

## Prepare the databases

Generate both Prisma clients:

```bash
npm run prisma:generate:all
```

Apply committed migrations to the kiosk database:

```bash
npx prisma migrate deploy
```

Seed the kiosk singleton and initial admin PIN:

```bash
npx prisma db seed
```

The seed reads the initial PIN from `ADMIN_PIN`. It does not seed OS4 users, bookings, or timeslots.

Never run Prisma migrations against `prisma-os4/schema.prisma`; that schema is a read-only mirror.

## Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful entry points:

| User | URL |
|---|---|
| Public kiosk | `/` |
| Student or peer mentor login | `/login` |
| Guest questionnaire | `/guest` |
| Staff login | `/admin/login` |

## Running with Docker (recommended for handoff)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Compose
- The separate OS4 database running and accessible
- A Resend account with a verified sender email

### OS4 database dependency

This app reads user and booking data from the OS4 project database. **OS4 is a separate project and must be running before this app will work.** This Compose project intentionally does not create or manage it.

If OS4 is running on the same machine:

1. Find OS4's published database port with `docker ps`.
2. In `OS4_DATABASE_URL`, use `host.docker.internal` instead of `localhost`, for example:
   `postgresql://postgres:PASSWORD@host.docker.internal:PORT/schedule_optimizer?schema=public`

If OS4 is hosted elsewhere, use its connection string directly. Prefer a read-only OS4 database user.

### Setup steps

1. Clone this repository.
2. Copy the template: `cp .env.docker.example .env`
3. Fill in every value in `.env`, especially `OS4_DATABASE_URL`, `JWT_SECRET`, `ADMIN_PIN`, and both occurrences of the kiosk database password.
4. Run `docker compose up --build`.
5. Open [http://localhost:3000](http://localhost:3000).

Kiosk migrations and the idempotent seed run automatically whenever the app container starts.

### Useful Docker commands

| Command | What it does |
|---|---|
| `docker compose up --build` | Build and start everything |
| `docker compose up -d` | Start in the background |
| `docker compose down` | Stop all containers |
| `docker compose down -v` | Stop and permanently delete kiosk data |
| `docker compose logs -f kiosk` | Watch app logs |
| `docker compose logs -f kiosk-db` | Watch database logs |
| `docker compose exec kiosk-db psql -U kioskuser -d kiosk` | Open the kiosk database shell |

### Data persistence

Kiosk data is stored in the `kiosk-db-data` Docker named volume. It survives `docker compose down` and image rebuilds. Only `docker compose down -v` deletes it.

### Ports used

| Service | Container port | Host port | Purpose |
|---|---:|---:|---|
| kiosk app | 3000 | 3000 | Web interface |
| kiosk-db | 5432 | 5434 | Optional direct database access |

Host port 5434 avoids conflicts with other PostgreSQL containers. Containers connect internally using `kiosk-db:5432`.

## Verify the installation

Check database health:

```bash
curl http://localhost:3000/api/health
```

A fully working installation returns a payload with:

```json
{
  "status": "ok",
  "kiosk_db": "ok",
  "os4_db": "ok",
  "timestamp": "..."
}
```

If OS4 is unavailable, the endpoint still responds and reports `status: "degraded"`, `os4_db: "error"`, and a warning. Kiosk-only database health remains visible instead of crashing the app.

Run the project checks:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

## Database tools

Open the kiosk database in Prisma Studio:

```bash
npx prisma studio
```

Open the OS4 database with its read-only schema:

```bash
npx prisma studio --schema=prisma-os4/schema.prisma
```

Create a new kiosk migration during development:

```bash
npx prisma migrate dev
```

## Admin PIN

The initial PIN comes from `ADMIN_PIN` when the kiosk database is seeded. The application stores a salted hash in the `AppSetting` record with ID `"admin"`. After signing in, an administrator can change it under Settings → Change PIN.

## Common problems

- If `/api/health` reports `kiosk_db: "error"`, verify `DATABASE_URL`, network access, and that kiosk migrations have been applied.
- If it reports `os4_db: "error"`, verify `OS4_DATABASE_URL` and ensure the separate OS4 database or local container is running.
- If Prisma client types are missing, rerun `npm run prisma:generate:all`.
- If email delivery fails, verify the Resend API key, verified sender, and test-recipient overrides.
- A Next.js warning about `middleware` being deprecated is currently expected and does not prevent the app from running.

## Contact

Built by: Malak Mohamed
Repository: [https://github.com/malakahmedsaad/check-in-system](https://github.com/malakahmedsaad/check-in-system)
Email: mohamedm@berea.edu
