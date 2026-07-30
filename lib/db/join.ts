// Purpose: Enriches kiosk database records with read-only OS4 data.

import type { Checkin, Shift } from "@prisma/client";

import { os4Prisma } from "../os4-prisma";

export type EnrichedCheckin = Checkin & {
  booking: {
    status: string;
    startDate: Date;
    endDate: Date;
    student: { name: string; email: string } | null;
    mentor: { name: string; email: string } | null;
    timeslot: {
      date: Date;
      startTime: string;
      endTime: string;
    } | null;
  } | null;
};

export type EnrichedShift = Shift & {
  mentor: { name: string; email: string } | null;
};

export async function enrichCheckinsWithOS4Data(
  checkins: Checkin[],
): Promise<EnrichedCheckin[]> {
  const bookings = await os4Prisma.booking.findMany({
    where: { id: { in: checkins.map((checkin) => checkin.bookingId) } },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      student: { select: { name: true, email: true } },
      mentor: { select: { name: true, email: true } },
      timeSlot: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  });
  const bookingsById = new Map(
    bookings.map((booking) => [
      booking.id,
      {
        ...booking,
        timeslot: booking.timeSlot,
      },
    ]),
  );

  return checkins.map((checkin) => ({
    ...checkin,
    booking: bookingsById.get(checkin.bookingId) ?? null,
  }));
}

export async function enrichShiftsWithMentorData(
  shifts: Shift[],
): Promise<EnrichedShift[]> {
  const mentors = await os4Prisma.user.findMany({
    where: { id: { in: shifts.map((shift) => shift.mentorId) } },
    select: { id: true, name: true, email: true },
  });
  const mentorsById = new Map(
    mentors.map((mentor) => [
      mentor.id,
      { name: mentor.name, email: mentor.email },
    ]),
  );

  return shifts.map((shift) => ({
    ...shift,
    mentor: mentorsById.get(shift.mentorId) ?? null,
  }));
}
