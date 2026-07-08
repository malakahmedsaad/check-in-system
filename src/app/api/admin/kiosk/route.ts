import { NextResponse } from "next/server";

import { verifyAdminPin } from "../../../../../lib/admin-pin";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

const KIOSK_STATUS_ID = "singleton";
const KIOSK_PIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const KIOSK_PIN_MAX_ATTEMPTS = 5;
const kioskPinAttempts = new Map<string, { count: number; resetAt: number }>();

function serializeStatus(status: {
  isOpen: boolean;
  openedAt: Date | null;
  closedAt: Date | null;
}) {
  return {
    isOpen: status.isOpen,
    openedAt: status.openedAt,
    closedAt: status.closedAt,
  };
}

async function findOrCreateKioskStatus() {
  const existingStatus = await prisma.kioskStatus.findFirst();

  if (existingStatus) {
    return existingStatus;
  }

  return prisma.kioskStatus.create({
    data: {
      id: KIOSK_STATUS_ID,
      isOpen: false,
    },
  });
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = kioskPinAttempts.get(key);

  if (!current || current.resetAt <= now) {
    kioskPinAttempts.set(key, {
      count: 1,
      resetAt: now + KIOSK_PIN_RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  return current.count > KIOSK_PIN_MAX_ATTEMPTS;
}

function clearRateLimit(key: string) {
  kioskPinAttempts.delete(key);
}

export async function GET() {
  try {
    const status = await prisma.kioskStatus.findFirst();

    if (!status) {
      return NextResponse.json({
        isOpen: false,
        openedAt: null,
        closedAt: null,
      });
    }

    return NextResponse.json(serializeStatus(status));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { action?: unknown; pin?: unknown };

    try {
      body = (await request.json()) as { action?: unknown; pin?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const action = body.action;
    const pin = typeof body.pin === "string" ? body.pin : "";

    if (action !== "open" && action !== "close") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateLimitKey = `${clientIp}:${session.email}`;

    // SECURITY: Rate limits kiosk PIN attempts so a logged-in device cannot be used to brute-force the PIN.
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    if (!(await verifyAdminPin(pin))) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    clearRateLimit(rateLimitKey);

    const status = await findOrCreateKioskStatus();
    const now = new Date();
    const expectedIsOpen = action === "open" ? false : true;
    const data =
      action === "open"
        ? {
            isOpen: true,
            openedAt: now,
            openedBy: session.email,
            closedAt: null,
          }
        : {
            isOpen: false,
            closedAt: now,
            closedBy: session.email,
          };

    const update = await prisma.kioskStatus.updateMany({
      where: {
        id: status.id,
        isOpen: expectedIsOpen,
      },
      data,
    });

    if (update.count !== 1) {
      return NextResponse.json(
        { error: "Kiosk status changed. Please refresh and try again." },
        { status: 409 },
      );
    }

    const updatedStatus = await prisma.kioskStatus.findUniqueOrThrow({
      where: { id: status.id },
    });

    return NextResponse.json(serializeStatus(updatedStatus));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
