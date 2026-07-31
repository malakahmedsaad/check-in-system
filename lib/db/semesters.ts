// Purpose: Provides semester period and reset audit-log data access.

import { prisma } from "../prisma";

export type CreateSemesterData = {
  name: string;
  startDate: Date;
  endDate: Date;
  createdBy: string;
};

export async function getAllSemesters() {
  return prisma.semester.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { resets: true } } },
  });
}

export async function getActiveSemester() {
  return prisma.semester.findFirst({ where: { isActive: true } });
}

export async function createSemester(data: CreateSemesterData) {
  if (data.startDate >= data.endDate) {
    throw new Error("Semester start date must be before its end date");
  }

  return prisma.semester.create({
    data: { ...data, isActive: false },
  });
}

export async function activateSemester(id: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.semester.updateMany({
      where: { id: { not: id }, isActive: true },
      data: { isActive: false },
    });
    return transaction.semester.update({
      where: { id },
      data: { isActive: true },
    });
  });
}

export async function resetSemester(
  semesterId: string,
  resetBy: string,
  resetByName: string,
  note?: string,
) {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { id: true },
  });
  if (!semester) throw new Error("Semester not found");

  return prisma.semesterReset.create({
    data: { semesterId, resetBy, resetByName, note },
  });
}
