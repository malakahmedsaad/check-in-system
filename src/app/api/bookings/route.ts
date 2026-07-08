import { NextResponse } from "next/server";

import { getBookingsByStudentId } from "../../../../lib/db/bookings";
import { getSession } from "../../../../lib/get-session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bookings = await getBookingsByStudentId(session.userId);

    return NextResponse.json(bookings);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
