// Purpose: Returns admin guest visit records, optionally filtered by app-local date.

import { NextResponse } from "next/server";

import { addDays, startOfAppDay } from "../../../../../lib/date-time";
import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

function getDateFilter(date: string | null) {
  if (!date) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "invalid";
  }

  const start = startOfAppDay(new Date(`${date}T12:00:00.000Z`));
  const end = addDays(start, 1);

  return { start, end };
}

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFilter = getDateFilter(searchParams.get("date"));

    if (dateFilter === "invalid") {
      return NextResponse.json(
        { error: "Use date format YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const guests = await prisma.guest.findMany({
      where: dateFilter
        ? {
            visitedAt: {
              gte: dateFilter.start,
              lt: dateFilter.end,
            },
          }
        : undefined,
      orderBy: {
        visitedAt: "desc",
      },
    });

    return NextResponse.json(guests);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
