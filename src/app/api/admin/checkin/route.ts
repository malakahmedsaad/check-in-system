// Purpose: Lists today's appointments and lets admins check students in.

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { APP_TIME_ZONE, getAppDayRange } from "../../../../../lib/date-time";
import { sendCheckinNotification } from "../../../../../lib/email";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const bookingInclude = {
  student: { select: { name: true, email: true } },
  mentor: { select: { name: true, email: true, mentorType: true } },
  timeslot: { select: { date: true, startTime: true, endTime: true } },
  checkin: true,
} satisfies Prisma.BookingInclude;

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { start, end } = getAppDayRange();
    const search = new URL(request.url).searchParams.get("search")?.trim().toLowerCase();
    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        timeslot: { date: { gte: start, lt: end } },
      },
      include: bookingInclude,
      orderBy: { timeslot: { startTime: "asc" } },
    });

    return NextResponse.json(
      search
        ? bookings.filter((booking) =>
            booking.student.name.toLowerCase().includes(search),
          )
        : bookings,
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { bookingId?: unknown };
    const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.checkin) {
      return NextResponse.json(
        { error: "Student is already checked in" },
        { status: 400 },
      );
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Booking is not confirmed" },
        { status: 400 },
      );
    }

    let checkin;

    try {
      checkin = await prisma.checkin.create({ data: { bookingId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Student is already checked in" },
          { status: 400 },
        );
      }

      throw error;
    }

    try {
      await sendCheckinNotification({
        mentorEmail: booking.mentor.email,
        mentorName: booking.mentor.name,
        studentName: booking.student.name,
        mentorType: booking.mentor.mentorType ?? "CONSULTATION",
        bookingDate: dateFormatter.format(booking.timeslot.date),
        startTime: timeFormatter.format(booking.timeslot.startTime),
        endTime: timeFormatter.format(booking.timeslot.endTime),
        checkedInAt: dateTimeFormatter.format(checkin.checkedInAt),
      });
    } catch (error) {
      console.error("Email failed:", error);
    }

    return NextResponse.json(checkin, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
