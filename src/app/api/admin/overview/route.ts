import { NextResponse } from "next/server";

import { getAppDayRange } from "../../../../../lib/date-time";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

export async function GET() {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { start, end } = getAppDayRange();
    const [totalGuestsToday, totalStudentsCheckedInToday, totalMentorsClockedIn] =
      await Promise.all([
        prisma.guest.count({
          where: {
            visitedAt: {
              gte: start,
              lt: end,
            },
          },
        }),
        prisma.checkin.count({
          where: {
            checkedInAt: {
              gte: start,
              lt: end,
            },
          },
        }),
        prisma.shift.count({
          where: {
            clockOutAt: null,
          },
        }),
      ]);

    return NextResponse.json({
      totalGuestsToday,
      totalStudentsCheckedInToday,
      totalMentorsClockedIn,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
