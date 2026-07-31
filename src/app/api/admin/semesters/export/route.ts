// Purpose: Exports a semester's mentor hours and reset history as CSV.

import { NextResponse } from "next/server";

import { generateCsv } from "@/lib/csv";
import { getSemesterHoursPerMentor } from "@/lib/db/shifts";
import { os4Prisma } from "@/lib/os4-prisma";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safeFilename(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "semester";
}

function csvHeaderCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const semesterId = new URL(request.url).searchParams.get("semesterId");
    if (!semesterId) {
      return NextResponse.json(
        { error: "semesterId is required" },
        { status: 400 },
      );
    }

    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: { resets: { orderBy: { resetAt: "desc" } } },
    });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    const hours = await getSemesterHoursPerMentor(semesterId);
    const mentors = await os4Prisma.user.findMany({
      where: { id: { in: hours.map(({ mentorId }) => mentorId) } },
      select: { id: true, name: true, email: true },
    });
    const mentorsById = new Map(mentors.map((mentor) => [mentor.id, mentor]));
    const totalHours = hours.reduce((total, entry) => total + entry.totalHours, 0);
    const totalMinutes = Math.round(totalHours * 60);

    const semesterSection = generateCsv(
      [
        csvHeaderCell(`Semester: ${semester.name}`),
        csvHeaderCell(
          `${formatDate(semester.startDate)} to ${formatDate(semester.endDate)}`,
        ),
      ],
      [],
    );
    const hoursSection = generateCsv(
      ["Mentor Name", "Mentor Email", "Total Hours", "Total Minutes"],
      [
        ...hours.map((entry) => {
          const mentor = mentorsById.get(entry.mentorId);
          return [
            mentor?.name ?? "Unknown mentor",
            mentor?.email ?? "",
            entry.totalHours.toFixed(2),
            Math.round(entry.totalHours * 60),
          ];
        }),
        ["Total", "", totalHours.toFixed(2), totalMinutes],
      ],
    );
    const resetSection = generateCsv(
      ["Reset Date", "Reset By", "Note"],
      semester.resets.map((reset) => [
        reset.resetAt.toISOString(),
        reset.resetByName,
        reset.note,
      ]),
    );
    const csv = [semesterSection, hoursSection, resetSection].join("\n\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(semester.name)}-timesheet.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to export semester" },
      { status: 500 },
    );
  }
}
