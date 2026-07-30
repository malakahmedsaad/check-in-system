// Purpose: Lets admins correct or remove any mentor shift.

import { NextResponse } from "next/server";

import { getShiftById } from "../../../../../../lib/db/shifts";
import { prisma } from "../../../../../../lib/prisma";
import { requireAdmin } from "../../../../../../lib/require-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const hasClockInAt = Object.hasOwn(body, "clockInAt");
    const hasClockOutAt = Object.hasOwn(body, "clockOutAt");
    const clockInAt = hasClockInAt ? parseDate(body.clockInAt) : undefined;
    const clockOutAt = hasClockOutAt ? parseDate(body.clockOutAt) : undefined;

    if (
      (hasClockInAt && !clockInAt) ||
      (hasClockOutAt && !clockOutAt)
    ) {
      return NextResponse.json(
        { error: "Clock-in and clock-out times must be valid ISO date strings" },
        { status: 400 },
      );
    }

    if (
      clockInAt &&
      clockOutAt &&
      clockOutAt.getTime() <= clockInAt.getTime()
    ) {
      return NextResponse.json(
        { error: "Clock-out time must be after clock-in time" },
        { status: 400 },
      );
    }

    const { id } = await context.params;
    const shift = await getShiftById(id);

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const updatedShift = await prisma.shift.update({
      where: {
        id,
      },
      data: {
        ...(clockInAt ? { clockInAt } : {}),
        ...(clockOutAt ? { clockOutAt } : {}),
      },
    });

    return NextResponse.json({ ...updatedShift, mentor: shift.mentor });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const shift = await getShiftById(id);

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    await prisma.shift.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
