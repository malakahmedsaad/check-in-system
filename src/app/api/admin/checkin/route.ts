// Purpose: Lists today's appointments and lets admins check students in.

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAppDayRange } from "../../../../../lib/date-time";
import {
  checkInToBooking,
  getBookingById,
  getConfirmedBookingsBetween,
} from "../../../../../lib/db/bookings";
import { sendCheckinNotification } from "../../../../../lib/email";
import { requireAdmin } from "../../../../../lib/require-admin";

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { start, end } = getAppDayRange();
    const search = new URL(request.url).searchParams.get("search")?.trim().toLowerCase();
    const bookings = await getConfirmedBookingsBetween(start, end);
    return NextResponse.json(
      search
        ? bookings.filter((booking) =>
            booking.student.name.toLowerCase().includes(search),
          )
        : bookings,
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as { bookingId?: unknown };
    const bookingId = Number(body.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }
    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.checkin) {
      return NextResponse.json({ error: "Student is already checked in" }, { status: 400 });
    }
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Booking is not confirmed" }, { status: 400 });
    }
    let checkin;
    try {
      checkin = await checkInToBooking(bookingId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "Student is already checked in" }, { status: 400 });
      }
      throw error;
    }
    try {
      await sendCheckinNotification({
        mentorEmail: booking.mentor.email,
        mentorName: booking.mentor.name,
        studentName: booking.student.name,
        bookingDate: booking.timeslot.date.toLocaleDateString("en-US"),
        startTime: booking.timeslot.startTime,
        endTime: booking.timeslot.endTime,
        checkedInAt: checkin.checkedInAt.toLocaleString("en-US"),
      });
    } catch (error) {
      console.error("Email failed:", error);
    }
    return NextResponse.json(checkin, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
