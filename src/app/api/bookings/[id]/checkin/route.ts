import { NextResponse } from "next/server";

import {
  checkInToBooking,
  getBookingById,
} from "../../../../../../lib/db/bookings";
import { getSession } from "../../../../../../lib/get-session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (booking.studentId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.checkin) {
      return NextResponse.json(
        { error: "Already checked in" },
        { status: 400 },
      );
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Booking is not confirmed" },
        { status: 400 },
      );
    }

    const checkin = await checkInToBooking(id);

    return NextResponse.json(checkin, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
