// Purpose: Provides mentor shift data access and shift state transition helpers.

import { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

export type ShiftRecord = Prisma.ShiftGetPayload<Record<string, never>>;
export type ShiftWithMentor = Prisma.ShiftGetPayload<{
  include: {
    mentor: {
      select: {
        name: true;
        email: true;
      };
    };
  };
}>;
export type MentorWithShiftStatus = {
  id: string;
  name: string;
  email: string;
  mentorType: "CONSULTATION" | "LAB" | null;
  mostRecentShift: ShiftRecord | null;
  isClockedIn: boolean;
};

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

export async function getActiveShiftForMentor(
  mentorId: string,
): Promise<ShiftWithMentor | null> {
  return prisma.shift.findFirst({
    where: {
      mentorId,
      clockOutAt: null,
    },
    orderBy: {
      clockInAt: "desc",
    },
    include: {
      mentor: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getAllMentorsWithShiftStatus(): Promise<
  MentorWithShiftStatus[]
> {
  const mentors = await prisma.user.findMany({
    where: {
      role: "mentor",
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      mentorType: true,
      shifts: {
        take: 1,
        orderBy: {
          clockInAt: "desc",
        },
      },
    },
  });

  return mentors.map(({ shifts, ...mentor }) => {
    const mostRecentShift = shifts[0] ?? null;

    return {
      ...mentor,
      mostRecentShift,
      isClockedIn:
        mostRecentShift !== null && mostRecentShift.clockOutAt === null,
    };
  });
}

export async function getShiftById(
  id: string,
): Promise<ShiftWithMentor | null> {
  return prisma.shift.findUnique({
    where: {
      id,
    },
    include: {
      mentor: {
        select: {
          name: true,
          email: true,
        },
      },
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
