// Purpose: Returns recent mentor shifts for admin analytics tables.

import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/prisma";
import { os4Prisma } from "../../../../../../lib/os4-prisma";
import { requireAdmin } from "../../../../../../lib/require-admin";

export async function GET() {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shifts = await prisma.shift.findMany({
      take: 50,
      orderBy: {
        clockInAt: "desc",
      },
    });
    const mentors = await os4Prisma.user.findMany({
      where: { id: { in: shifts.map((shift) => shift.mentorId) } },
      select: { id: true, name: true },
    });
    const mentorNames = new Map(mentors.map((mentor) => [mentor.id, mentor.name]));

    return NextResponse.json(
      shifts.map((shift) => {
        const durationHours = shift.clockOutAt
          ? (shift.clockOutAt.getTime() - shift.clockInAt.getTime()) /
            (1000 * 60 * 60)
          : null;

        return {
          id: shift.id,
          mentorName: mentorNames.get(shift.mentorId) ?? "Unknown mentor",
          clockInAt: shift.clockInAt,
          clockOutAt: shift.clockOutAt,
          durationHours,
        };
      }),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
