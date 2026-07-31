// Purpose: Lists semester summaries and lets admins define new semesters.

import { NextResponse } from "next/server";

import {
  createSemester,
  getActiveSemester,
  getAllSemesters,
} from "@/lib/db/semesters";
import { getSemesterHoursPerMentor } from "@/lib/db/shifts";
import { os4Prisma } from "@/lib/os4-prisma";
import { requireAdmin } from "@/lib/require-admin";

async function enrichHoursWithMentors(
  hours: Awaited<ReturnType<typeof getSemesterHoursPerMentor>>,
) {
  const mentors = await os4Prisma.user.findMany({
    where: { id: { in: hours.map(({ mentorId }) => mentorId) } },
    select: { id: true, name: true, email: true },
  });
  const mentorsById = new Map(mentors.map((mentor) => [mentor.id, mentor]));

  return hours.map((entry) => ({
    ...entry,
    name: mentorsById.get(entry.mentorId)?.name ?? "Unknown mentor",
    email: mentorsById.get(entry.mentorId)?.email ?? "",
  }));
}

function parseDate(value: unknown, endOfDay = false): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalizedValue =
    endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T23:59:59.999Z`
      : value;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [semesters, activeSemester] = await Promise.all([
      getAllSemesters(),
      getActiveSemester(),
    ]);
    const activeHours = activeSemester
      ? await enrichHoursWithMentors(
          await getSemesterHoursPerMentor(activeSemester.id),
        )
      : null;

    return NextResponse.json(
      semesters.map((semester) => ({
        ...semester,
        ...(semester.id === activeSemester?.id
          ? { hoursPerMentor: activeHours }
          : {}),
      })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load semesters" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate, true);
    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Name, start date, and end date are required" },
        { status: 400 },
      );
    }
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "Semester start date must be before its end date" },
        { status: 400 },
      );
    }

    const semester = await createSemester({
      name,
      startDate,
      endDate,
      createdBy: String(session.userId),
    });
    return NextResponse.json(semester, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to create semester" },
      { status: 500 },
    );
  }
}
