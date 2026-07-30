// Purpose: Exposes a health check endpoint that verifies API and database availability.

import { NextResponse } from "next/server";

import { os4Prisma } from "@/lib/os4-prisma";
import { prisma } from "@/lib/prisma";

async function checkKioskDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}

async function checkOs4Database() {
  try {
    await os4Prisma.$queryRaw`SELECT 1`;
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}

export async function GET() {
  const [kioskDatabase, os4Database] = await Promise.all([
    checkKioskDatabase(),
    checkOs4Database(),
  ]);
  const status =
    kioskDatabase === "ok" && os4Database === "ok"
      ? "ok"
      : kioskDatabase === "error" && os4Database === "error"
        ? "down"
        : "degraded";

  return NextResponse.json({
    status,
    kiosk_db: kioskDatabase,
    os4_db: os4Database,
    ...(os4Database === "error"
      ? {
          warning:
            "OS4 database is unavailable. The kiosk API is running, but OS4-backed features will not work.",
        }
      : {}),
    timestamp: new Date().toISOString(),
  });
}
