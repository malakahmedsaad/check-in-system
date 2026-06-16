import type { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

export type BookingWithStudentSummary = Prisma.BookingGetPayload<{
  include: {
    timeslot: {
      select: {
        date: true;
        startTime: true;
        endTime: true;
      };
    };
    mentor: {
      select: {
        name: true;
        email: true;
        mentorType: true;
      };
    };
    checkin: true;
  };
}>;

export type BookingDetails = Prisma.BookingGetPayload<{
  include: {
    timeslot: true;
    mentor: true;
    student: true;
    checkin: true;
  };
}>;

export type BookingCheckin = Prisma.CheckinGetPayload<Record<string, never>>;

export async function getBookingsByStudentId(
  studentId: string,
): Promise<BookingWithStudentSummary[]> {
  return prisma.booking.findMany({
    where: {
      studentId,
      status: "CONFIRMED",
    },
    include: {
      timeslot: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
        },
      },
      mentor: {
        select: {
          name: true,
          email: true,
          mentorType: true,
        },
      },
      checkin: true,
    },
    orderBy: {
      timeslot: {
        date: "asc",
      },
    },
  });
}

export async function getBookingById(
  id: string,
): Promise<BookingDetails | null> {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      timeslot: true,
      mentor: true,
      student: true,
      checkin: true,
    },
  });
}

export async function checkInToBooking(
  bookingId: string,
): Promise<BookingCheckin> {
  return prisma.checkin.create({
    data: { bookingId },
  });
}
