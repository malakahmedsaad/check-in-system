// Purpose: Checks a student into a booking and sends a non-blocking notification email.

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  checkInToBooking,
  getBookingById,
} from "../../../../../../lib/db/bookings";
import { computeCheckinWindow } from "../../../../../../lib/checkin-window";
import { sendCheckinNotification } from "../../../../../../lib/email";
import { getSession } from "../../../../../../lib/get-session";
import { prisma } from "../../../../../../lib/prisma";
import { APP_TIME_ZONE } from "../../../../../../lib/date-time";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

const cuidPattern = /^c[a-z0-9]{20,32}$/i;

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const kioskStatus = await prisma.kioskStatus.findFirst();

    if (!kioskStatus?.isOpen) {
      return NextResponse.json(
        { error: "Kiosk is currently closed" },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!cuidPattern.test(id)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (booking.studentId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.checkin) {
      return NextResponse.json(
        { error: "Already checked in" },
        { status: 400 },
      );
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Booking is not confirmed" },
        { status: 400 },
      );
    }

    const { windowOpen, tooEarly, tooLate } = computeCheckinWindow(
      new Date(booking.timeslot.startTime),
    );

    if (tooEarly) {
      const formattedWindowOpen = windowOpen.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      return NextResponse.json(
        {
          error: "Too early to check in",
          message: `Check-in opens 15 minutes before your appointment. Come back at ${formattedWindowOpen}.`,
        },
        { status: 400 },
      );
    }

    if (tooLate) {
      return NextResponse.json(
        {
          error: "Check-in window has passed",
          message:
            "The check-in window for this appointment has closed. Please speak with front desk staff.",
        },
        { status: 400 },
      );
    }

    let checkin;

    try {
      checkin = await checkInToBooking(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Already checked in" },
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
