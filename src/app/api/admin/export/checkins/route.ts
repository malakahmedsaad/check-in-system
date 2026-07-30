// Purpose: Exports check-in records enriched with OS4 booking data as CSV.

import { NextResponse } from "next/server";

import { generateCsv } from "@/lib/csv";
import { APP_TIME_ZONE, addDays, getDateKey, startOfAppDay } from "@/lib/date-time";
import { enrichCheckinsWithOS4Data } from "@/lib/db/join";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function parseDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value ? undefined : null;
  }

  const probe = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(probe.getTime()) || getDateKey(probe) !== value) {
    return undefined;
  }

  return startOfAppDay(probe);
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = parseDateKey(searchParams.get("from"));
    const to = parseDateKey(searchParams.get("to"));

    if (from === undefined || to === undefined || (from && to && from > to)) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 },
      );
    }

    const checkins = await prisma.checkin.findMany({
      where:
        from || to
          ? {
              checkedInAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: addDays(to, 1) } : {}),
              },
            }
          : undefined,
      orderBy: { checkedInAt: "desc" },
    });
    const enrichedCheckins = await enrichCheckinsWithOS4Data(checkins);
    const csv = generateCsv(
      [
        "Student Name",
        "Student Email",
        "Mentor Name",
        "Appointment Date",
        "Appointment Start Time",
        "Appointment End Time",
        "Booking Status",
        "Checked In At",
      ],
      enrichedCheckins.map((checkin) => [
        checkin.booking?.student?.name,
        checkin.booking?.student?.email,
        checkin.booking?.mentor?.name,
        checkin.booking?.timeslot
          ? dateFormatter.format(checkin.booking.timeslot.date)
          : checkin.booking
            ? dateFormatter.format(checkin.booking.startDate)
            : null,
        checkin.booking?.timeslot?.startTime,
        checkin.booking?.timeslot?.endTime,
        checkin.booking?.status,
        dateTimeFormatter.format(checkin.checkedInAt),
      ]),
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="checkins.csv"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to export check-ins" },
      { status: 500 },
    );
  }
}
