import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/prisma";
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
      include: {
        mentor: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      shifts.map((shift) => {
        const durationHours = shift.clockOutAt
          ? (shift.clockOutAt.getTime() - shift.clockInAt.getTime()) /
            (1000 * 60 * 60)
          : null;

        return {
          id: shift.id,
          mentorName: shift.mentor.name,
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
