import { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

export type ShiftRecord = Prisma.ShiftGetPayload<Record<string, never>>;

export class ShiftStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiftStateError";
  }
}

export async function getActiveShift(
  mentorId: string,
): Promise<ShiftRecord | null> {
  return prisma.shift.findFirst({
    where: {
      mentorId,
      clockOutAt: null,
    },
    orderBy: {
      clockInAt: "desc",
    },
  });
}

export async function clockIn(mentorId: string): Promise<ShiftRecord> {
  const activeShift = await getActiveShift(mentorId);

  if (activeShift) {
    throw new ShiftStateError("Mentor is already clocked in");
  }

  try {
    return await prisma.shift.create({
      data: {
        mentorId,
        clockInAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ShiftStateError("Mentor is already clocked in");
    }

    throw error;
  }
}

export async function clockOut(mentorId: string): Promise<ShiftRecord> {
  const activeShift = await getActiveShift(mentorId);

  if (!activeShift) {
    throw new ShiftStateError("No active shift found");
  }

  return prisma.shift.update({
    where: {
      id: activeShift.id,
    },
    data: {
      clockOutAt: new Date(),
    },
  });
}

export async function getShiftsByMentorId(
  mentorId: string,
  limit = 30,
): Promise<ShiftRecord[]> {
  return prisma.shift.findMany({
    where: {
      mentorId,
      clockOutAt: {
        not: null,
      },
    },
    take: limit,
    orderBy: {
      clockInAt: "desc",
    },
  });
}

export async function getCompletedShiftHoursByMentorId(
  mentorId: string,
): Promise<number> {
  const shifts = await prisma.shift.findMany({
    where: {
      mentorId,
      clockOutAt: {
        not: null,
      },
    },
    select: {
      clockInAt: true,
      clockOutAt: true,
    },
  });

  return shifts.reduce((totalHours, shift) => {
    if (!shift.clockOutAt) {
      return totalHours;
    }

    const durationHours =
      (shift.clockOutAt.getTime() - shift.clockInAt.getTime()) /
      (1000 * 60 * 60);

    return totalHours + Math.max(0, durationHours);
  }, 0);
}
