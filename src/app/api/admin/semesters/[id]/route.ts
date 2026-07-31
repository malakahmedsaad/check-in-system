// Purpose: Returns semester details and handles activation and reset events.

import { NextResponse } from "next/server";

import { activateSemester, resetSemester } from "@/lib/db/semesters";
import { getSemesterHoursPerMentor } from "@/lib/db/shifts";
import { os4Prisma } from "@/lib/os4-prisma";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

type RouteContext = { params: Promise<{ id: string }> };

async function getEnrichedHours(semesterId: string) {
  const hours = await getSemesterHoursPerMentor(semesterId);
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: { resets: { orderBy: { resetAt: "desc" } } },
    });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    const hoursPerMentor = await getEnrichedHours(id);
    const grandTotalHours = hoursPerMentor.reduce(
      (total, mentor) => total + mentor.totalHours,
      0,
    );
    return NextResponse.json({
      ...semester,
      hoursPerMentor,
      grandTotalHours,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load semester" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
    if (body.action !== "activate" && body.action !== "reset") {
      return NextResponse.json(
        { error: 'Action must be either "activate" or "reset"' },
        { status: 400 },
      );
    }
    if (body.note !== undefined && typeof body.note !== "string") {
      return NextResponse.json({ error: "Note must be a string" }, { status: 400 });
    }

    const { id } = await context.params;
    if (body.action === "activate") {
      return NextResponse.json(await activateSemester(id));
    }

    const note = typeof body.note === "string" ? body.note.trim() || undefined : undefined;
    return NextResponse.json(
      await resetSemester(
        id,
        String(session.userId),
        session.name,
        note,
      ),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Semester not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Unable to update semester" },
      { status: 500 },
    );
  }
}
