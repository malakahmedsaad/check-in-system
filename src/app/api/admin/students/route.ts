import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/require-admin";

export async function GET() {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const students = await prisma.user.findMany({
      where: {
        role: "student",
      },
      orderBy: {
        name: "asc",
      },
      include: {
        bookingsAsStudent: {
          orderBy: {
            startDate: "desc",
          },
          include: {
            mentor: {
              select: {
                name: true,
                email: true,
              },
            },
            timeslot: true,
            checkin: true,
          },
        },
      },
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
