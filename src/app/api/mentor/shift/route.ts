import { NextResponse } from "next/server";

import {
  clockIn,
  clockOut,
  getActiveShift,
  getCompletedShiftHoursByMentorId,
  getShiftsByMentorId,
  ShiftStateError,
} from "../../../../../lib/db/shifts";
import { getSession } from "../../../../../lib/get-session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "mentor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [activeShift, recentShifts, completedShiftHours] = await Promise.all([
      getActiveShift(session.userId),
      getShiftsByMentorId(session.userId),
      getCompletedShiftHoursByMentorId(session.userId),
    ]);

    return NextResponse.json({
      activeShift,
      recentShifts,
      completedShiftHours,
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

    let body: { action?: unknown };

    try {
      body = (await request.json()) as { action?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

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
      if (error instanceof ShiftStateError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      console.error(error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
