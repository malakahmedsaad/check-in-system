#!/bin/sh
set -e

echo "Running Prisma migrations..."
pnpm exec prisma migrate deploy

echo "Running seed (idempotent — safe to run multiple times)..."
pnpm exec prisma db seed

echo "Starting kiosk app..."
exec node server.js
