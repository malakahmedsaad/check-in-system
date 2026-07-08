import { NextResponse } from "next/server";

import { updateAdminPin, verifyAdminPin } from "../../../../../../lib/admin-pin";
import { requireAdmin } from "../../../../../../lib/require-admin";

const pinPattern = /^\d{4,6}$/;

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { currentPin?: unknown; newPin?: unknown };

    try {
      body = (await request.json()) as {
        currentPin?: unknown;
        newPin?: unknown;
      };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const currentPin =
      typeof body.currentPin === "string" ? body.currentPin : "";
    const newPin = typeof body.newPin === "string" ? body.newPin : "";

    if (!currentPin) {
      return NextResponse.json(
        { error: "Current PIN is required" },
        { status: 400 },
      );
    }

    if (!pinPattern.test(newPin)) {
      return NextResponse.json(
        { error: "New PIN must be 4 to 6 digits" },
        { status: 400 },
      );
    }

    if (!(await verifyAdminPin(currentPin))) {
      return NextResponse.json(
        { error: "Current PIN is incorrect" },
        { status: 400 },
      );
    }

    await updateAdminPin(newPin);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
