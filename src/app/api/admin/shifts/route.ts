// Purpose: Lists mentor shift history or the latest shift status for every mentor.

import { NextResponse } from "next/server";

import { getAllMentorsWithShiftStatus } from "../../../../../lib/db/shifts";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mentorId = new URL(request.url).searchParams.get("mentorId");

    if (mentorId) {
      const parsedMentorId = Number(mentorId);
      if (!Number.isInteger(parsedMentorId) || parsedMentorId <= 0) {
        return NextResponse.json({ error: "Invalid mentor id" }, { status: 400 });
      }
      const shifts = await prisma.shift.findMany({
        where: {
          mentorId: parsedMentorId,
        },
        orderBy: {
          clockInAt: "desc",
        },
        take: 50,
      });

      return NextResponse.json(shifts);
    }

    const mentors = await getAllMentorsWithShiftStatus();

    return NextResponse.json(mentors);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
