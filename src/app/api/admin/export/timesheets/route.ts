// Purpose: Exports mentor shift records enriched with OS4 mentor data as CSV.

import { NextResponse } from "next/server";

import { generateCsv } from "@/lib/csv";
import { APP_TIME_ZONE } from "@/lib/date-time";
import { enrichShiftsWithMentorData } from "@/lib/db/join";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mentorIdValue = new URL(request.url).searchParams.get("mentorId");
    const mentorId = mentorIdValue === null ? null : Number(mentorIdValue);

    if (
      mentorIdValue !== null &&
      (!Number.isInteger(mentorId) || (mentorId ?? 0) <= 0)
    ) {
      return NextResponse.json(
        { error: "Invalid mentor id" },
        { status: 400 },
      );
    }

    const shifts = await prisma.shift.findMany({
      where: mentorId === null ? undefined : { mentorId },
      orderBy: { clockInAt: "desc" },
    });
    const enrichedShifts = await enrichShiftsWithMentorData(shifts);
    const csv = generateCsv(
      [
        "Mentor Name",
        "Mentor Email",
        "Clock In",
        "Clock Out",
        "Duration (hours)",
        "Date",
      ],
      enrichedShifts.map((shift) => [
        shift.mentor?.name,
        shift.mentor?.email,
        dateTimeFormatter.format(shift.clockInAt),
        shift.clockOutAt
          ? dateTimeFormatter.format(shift.clockOutAt)
          : "In progress",
        shift.clockOutAt
          ? (
              (shift.clockOutAt.getTime() - shift.clockInAt.getTime()) /
              3_600_000
            ).toFixed(2)
          : "In progress",
        dateFormatter.format(shift.clockInAt),
      ]),
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="timesheets.csv"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to export timesheets" },
      { status: 500 },
    );
  }
}
