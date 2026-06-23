import { NextResponse } from "next/server";

import {
  clockIn,
  clockOut,
  getActiveShift,
  getShiftsByMentorId,
} from "../../../../../lib/db/shifts";
import { getSession } from "../../../../../lib/get-session";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update shift";
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "mentor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [activeShift, recentShifts] = await Promise.all([
      getActiveShift(session.userId),
      getShiftsByMentorId(session.userId),
    ]);

    return NextResponse.json({
      activeShift,
      recentShifts,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "mentor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { action?: unknown };
    const action = body.action;

    if (action !== "clock_in" && action !== "clock_out") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    try {
      const shift =
        action === "clock_in"
          ? await clockIn(session.userId)
          : await clockOut(session.userId);

      return NextResponse.json(shift);
    } catch (error) {
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
