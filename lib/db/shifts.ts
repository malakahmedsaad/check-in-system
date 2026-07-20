// Purpose: Provides mentor shift data access across OS4 and kiosk databases.

import { Prisma, type Shift } from "@prisma/client";

import { os4Prisma } from "../os4-prisma";
import { prisma } from "../prisma";

export type ShiftRecord = Shift;
export type ShiftWithMentor = Shift & {
  mentor: { name: string; email: string };
};
export type MentorWithShiftStatus = {
  id: number;
  name: string;
  email: string;
  mostRecentShift: ShiftRecord | null;
  isClockedIn: boolean;
};

export class ShiftStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiftStateError";
  }
}

export async function getActiveShift(mentorId: number) {
  return prisma.shift.findFirst({
    where: { mentorId, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
}

async function attachMentor(shift: Shift | null): Promise<ShiftWithMentor | null> {
  if (!shift) return null;
  const mentor = await os4Prisma.user.findUnique({
    where: { id: shift.mentorId },
    select: { name: true, email: true },
  });
  return mentor ? { ...shift, mentor } : null;
}

export async function getActiveShiftForMentor(mentorId: number) {
  return attachMentor(await getActiveShift(mentorId));
}

export async function getAllMentorsWithShiftStatus(): Promise<MentorWithShiftStatus[]> {
  const mentors = await os4Prisma.user.findMany({
    where: { role: "PEER_MENTOR" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const shifts = await prisma.shift.findMany({
    where: { mentorId: { in: mentors.map((mentor) => mentor.id) } },
    orderBy: { clockInAt: "desc" },
  });

  return mentors.map((mentor) => {
    const mostRecentShift =
      shifts.find((shift) => shift.mentorId === mentor.id) ?? null;
    return {
      ...mentor,
      mostRecentShift,
      isClockedIn: mostRecentShift?.clockOutAt === null,
    };
  });
}

export async function getShiftById(id: string) {
  return attachMentor(await prisma.shift.findUnique({ where: { id } }));
}

export async function clockIn(mentorId: number): Promise<ShiftRecord> {
  if (await getActiveShift(mentorId)) {
    throw new ShiftStateError("Mentor is already clocked in");
  }
  try {
    return await prisma.shift.create({ data: { mentorId, clockInAt: new Date() } });
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

export async function clockOut(mentorId: number): Promise<ShiftRecord> {
  const activeShift = await getActiveShift(mentorId);
  if (!activeShift) throw new ShiftStateError("No active shift found");
  return prisma.shift.update({
    where: { id: activeShift.id },
    data: { clockOutAt: new Date() },
  });
}

export async function getShiftsByMentorId(mentorId: number, limit = 30) {
  return prisma.shift.findMany({
    where: { mentorId, clockOutAt: { not: null } },
    take: limit,
    orderBy: { clockInAt: "desc" },
  });
}

export async function getCompletedShiftHoursByMentorId(mentorId: number) {
  const shifts = await prisma.shift.findMany({
    where: { mentorId, clockOutAt: { not: null } },
    select: { clockInAt: true, clockOutAt: true },
  });
  return shifts.reduce((totalHours, shift) => {
    if (!shift.clockOutAt) return totalHours;
    return (
      totalHours +
      Math.max(
        0,
        (shift.clockOutAt.getTime() - shift.clockInAt.getTime()) / 3_600_000,
      )
    );
  }, 0);
}
