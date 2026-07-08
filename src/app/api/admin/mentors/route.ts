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
    const [mentors, allMentorShifts] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "mentor",
        },
        orderBy: {
          name: "asc",
        },
        include: {
          shifts: {
            take: 10,
            orderBy: {
              clockInAt: "desc",
            },
          },
          _count: {
            select: {
              bookingsAsMentor: {
                where: {
                  startDate: {
                    gte: start,
                    lt: end,
                  },
                },
              },
            },
          },
        },
      }),
      prisma.shift.findMany({
        select: {
          mentorId: true,
          clockInAt: true,
          clockOutAt: true,
        },
      }),
    ]);

    const now = new Date();
    const totalHoursByMentor = new Map<string, number>();

    allMentorShifts.forEach((shift) => {
      const endTime = shift.clockOutAt ?? now;
      const durationHours =
        (endTime.getTime() - shift.clockInAt.getTime()) / (1000 * 60 * 60);

      totalHoursByMentor.set(
        shift.mentorId,
        (totalHoursByMentor.get(shift.mentorId) ?? 0) +
          Math.max(0, durationHours),
      );
    });

    return NextResponse.json(
      mentors.map((mentor) => ({
        id: mentor.id,
        name: mentor.name,
        email: mentor.email,
        mentorType: mentor.mentorType,
        todaysAppointmentCount: mentor._count.bookingsAsMentor,
        totalHours: totalHoursByMentor.get(mentor.id) ?? 0,
        shifts: mentor.shifts,
      })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
