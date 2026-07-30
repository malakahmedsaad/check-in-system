// Purpose: Returns admin mentor summaries with appointments, total hours, and recent shifts.

import { NextResponse } from "next/server";

import { getAppDayRange } from "../../../../../lib/date-time";
import { os4Prisma } from "../../../../../lib/os4-prisma";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { start, end } = getAppDayRange();
    const [mentors, allMentorShifts] = await Promise.all([
      os4Prisma.user.findMany({
        where: { role: "PEER_MENTOR" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      }),
      prisma.shift.findMany({ orderBy: { clockInAt: "desc" } }),
    ]);
    const counts = await os4Prisma.booking.groupBy({
      by: ["labMentorId"],
      where: { labMentorId: { in: mentors.map((mentor) => mentor.id) }, startDate: { gte: start, lt: end } },
      _count: true,
    });
    const countByMentor = new Map(counts.map((row) => [row.labMentorId, row._count]));
    const now = new Date();
    return NextResponse.json(mentors.map((mentor) => {
      const shifts = allMentorShifts.filter((shift) => shift.mentorId === mentor.id);
      const totalHours = shifts.reduce((total, shift) => {
        const endTime = shift.clockOutAt ?? now;
        return total + Math.max(0, (endTime.getTime() - shift.clockInAt.getTime()) / 3_600_000);
      }, 0);
      return {
        ...mentor,
        todaysAppointmentCount: countByMentor.get(mentor.id) ?? 0,
        totalHours,
        shifts: shifts.slice(0, 10),
      };
    }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
