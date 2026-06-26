import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

const KIOSK_STATUS_ID = "singleton";

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
  return prisma.kioskStatus.upsert({
    where: {
      id: KIOSK_STATUS_ID,
    },
    update: {},
    create: {
      id: KIOSK_STATUS_ID,
      isOpen: false,
    },
  });
}

export async function GET() {
  try {
    const status = await prisma.kioskStatus.findUnique({
      where: {
        id: KIOSK_STATUS_ID,
      },
    });

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

    let body: { action?: unknown };

    try {
      body = (await request.json()) as { action?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const action = body.action;

    if (action !== "open" && action !== "close") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const status = await findOrCreateKioskStatus();
    const now = new Date();
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

    const updatedStatus = await prisma.kioskStatus.update({
      where: { id: status.id },
      data,
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
