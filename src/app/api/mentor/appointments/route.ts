// Purpose: Returns today's appointments for the signed-in mentor.

import { NextResponse } from "next/server";
import { getAppDayRange } from "../../../../../lib/date-time";
import { getConfirmedBookingsBetween } from "../../../../../lib/db/bookings";
import { getSession } from "../../../../../lib/get-session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { start, end } = getAppDayRange();
    const appointments = (await getConfirmedBookingsBetween(start, end)).filter(
      (booking) => booking.labMentorId === session.userId,
    );
    return NextResponse.json(appointments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
