import { NextResponse } from "next/server";

import { getSession } from "../../../../../lib/get-session";
import { prisma } from "../../../../../lib/prisma";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "mentor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { start, end } = getTodayRange();
    const appointments = await prisma.booking.findMany({
      where: {
        mentorId: session.userId,
        status: "CONFIRMED",
        timeslot: {
          date: {
            gte: start,
            lt: end,
          },
        },
      },
      include: {
        student: {
          select: {
            name: true,
            email: true,
          },
        },
        timeslot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
        checkin: true,
      },
      orderBy: {
        timeslot: {
          startTime: "asc",
        },
      },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
