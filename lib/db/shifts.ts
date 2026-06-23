import type { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

export type ShiftRecord = Prisma.ShiftGetPayload<Record<string, never>>;

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
    throw new Error("Mentor is already clocked in");
  }

  return prisma.shift.create({
    data: {
      mentorId,
      clockInAt: new Date(),
    },
  });
}

export async function clockOut(mentorId: string): Promise<ShiftRecord> {
  const activeShift = await getActiveShift(mentorId);

  if (!activeShift) {
    throw new Error("No active shift found");
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
