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

    if (typeof body.mentorId !== "string" || !body.mentorId) {
      return NextResponse.json(
        { error: "mentorId is required" },
        { status: 400 },
      );
    }

    const activeShift = await getActiveShiftForMentor(body.mentorId);

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
      include: {
        mentor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
