// Purpose: Lets an admin force-clock out a mentor with an active shift.

import { NextResponse } from "next/server";

import { getActiveShiftForMentor } from "../../../../../../lib/db/shifts";
import { prisma } from "../../../../../../lib/prisma";
import { requireAdmin } from "../../../../../../lib/require-admin";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { mentorId?: unknown };

    try {
      body = (await request.json()) as { mentorId?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const mentorId = Number(body.mentorId);
    if (!Number.isInteger(mentorId) || mentorId <= 0) {
      return NextResponse.json(
        { error: "mentorId is required" },
        { status: 400 },
      );
    }

    const activeShift = await getActiveShiftForMentor(mentorId);

    if (!activeShift) {
      return NextResponse.json(
        { error: "No active shift found for this mentor" },
        { status: 404 },
      );
    }

    // This is an admin override — it does not notify the mentor
    const updatedShift = await prisma.shift.update({
      where: {
        id: activeShift.id,
      },
      data: {
        clockOutAt: new Date(),
      },
    });

    return NextResponse.json({ ...updatedShift, mentor: activeShift.mentor });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
