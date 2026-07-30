// Purpose: Returns admin student records with OS4 booking and kiosk check-in history.

import { NextResponse } from "next/server";
import { os4Prisma } from "../../../../../lib/os4-prisma";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

export async function GET() {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const students = await os4Prisma.user.findMany({
      where: { role: "MEMBER" },
      orderBy: { name: "asc" },
      include: {
        bookings: {
          orderBy: { startDate: "desc" },
          include: { mentor: { select: { name: true, email: true } }, timeSlot: true },
        },
      },
    });
    const bookingIds = students.flatMap((student) => student.bookings.map((booking) => booking.id));
    const checkins = await prisma.checkin.findMany({ where: { bookingId: { in: bookingIds } } });
    const checkinByBooking = new Map(checkins.map((checkin) => [checkin.bookingId, checkin]));
    return NextResponse.json(students.map(({ bookings, ...student }) => ({
      ...student,
      bookingsAsStudent: bookings.map(({ timeSlot, ...booking }) => ({
        ...booking,
        timeslot: timeSlot,
        checkin: checkinByBooking.get(booking.id) ?? null,
      })),
    })));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
