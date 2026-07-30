// Purpose: Provides student booking and check-in data access across OS4 and kiosk databases.

import type { Checkin } from "@prisma/client";

import { os4Prisma } from "../os4-prisma";
import { prisma } from "../prisma";

type BookingRelations = {
  student: { id: number; name: string; email: string };
  mentor: { id: number; name: string; email: string };
  timeslot: {
    id: number;
    date: Date;
    startTime: string;
    endTime: string;
  };
  checkin: Checkin | null;
};

export type BookingWithStudentSummary = {
  id: number;
  userId: number;
  labMentorId: number;
  timeSlotId: number;
  startDate: Date;
  endDate: Date;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "ABSENT";
} & BookingRelations;

export type BookingDetails = BookingWithStudentSummary;
export type BookingCheckin = Checkin;

async function attachCheckins<T extends { id: number }>(bookings: T[]) {
  const checkins = await prisma.checkin.findMany({
    where: { bookingId: { in: bookings.map((booking) => booking.id) } },
  });
  const checkinByBooking = new Map(
    checkins.map((checkin) => [checkin.bookingId, checkin]),
  );

  return bookings.map((booking) => ({
    ...booking,
    checkin: checkinByBooking.get(booking.id) ?? null,
  }));
}

export async function getBookingsByStudentId(
  studentId: number,
): Promise<BookingWithStudentSummary[]> {
  const bookings = await os4Prisma.booking.findMany({
    where: {
      userId: studentId,
      status: "CONFIRMED",
      labMentorId: { not: null },
      timeSlotId: { not: null },
    },
    include: { student: true, mentor: true, timeSlot: true },
    orderBy: { startDate: "asc" },
  });
  const complete = bookings.flatMap((booking) =>
    booking.userId !== null &&
    booking.labMentorId !== null &&
    booking.timeSlotId !== null &&
    booking.student &&
    booking.mentor &&
    booking.timeSlot
      ? [
          {
            ...booking,
            userId: booking.userId,
            labMentorId: booking.labMentorId,
            timeSlotId: booking.timeSlotId,
            student: booking.student,
            mentor: booking.mentor,
            timeslot: booking.timeSlot,
          },
        ]
      : [],
  );

  return attachCheckins(complete);
}

export async function getBookingById(
  id: number,
): Promise<BookingDetails | null> {
  const booking = await os4Prisma.booking.findUnique({
    where: { id },
    include: { student: true, mentor: true, timeSlot: true },
  });

  if (
    !booking ||
    booking.userId === null ||
    booking.labMentorId === null ||
    booking.timeSlotId === null ||
    !booking.student ||
    !booking.mentor ||
    !booking.timeSlot
  ) {
    return null;
  }

  const [result] = await attachCheckins([
    {
      ...booking,
      userId: booking.userId,
      labMentorId: booking.labMentorId,
      timeSlotId: booking.timeSlotId,
      student: booking.student,
      mentor: booking.mentor,
      timeslot: booking.timeSlot,
    },
  ]);
  return result;
}

export async function getConfirmedBookingsBetween(start: Date, end: Date) {
  const bookings = await os4Prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      startDate: { gte: start, lt: end },
      userId: { not: null },
      labMentorId: { not: null },
      timeSlotId: { not: null },
    },
    include: { student: true, mentor: true, timeSlot: true },
    orderBy: { startDate: "asc" },
  });
  const complete = bookings.flatMap((booking) =>
    booking.userId !== null &&
    booking.labMentorId !== null &&
    booking.timeSlotId !== null &&
    booking.student &&
    booking.mentor &&
    booking.timeSlot
      ? [{
          ...booking,
          userId: booking.userId,
          labMentorId: booking.labMentorId,
          timeSlotId: booking.timeSlotId,
          student: booking.student,
          mentor: booking.mentor,
          timeslot: booking.timeSlot,
        }]
      : [],
  );
  return attachCheckins(complete);
}

export async function checkInToBooking(
  bookingId: number,
): Promise<BookingCheckin> {
  return prisma.checkin.create({ data: { bookingId } });
}
