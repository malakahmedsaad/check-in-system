import { NextResponse } from "next/server";

import { signToken } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  let body: { email?: unknown; pin?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; pin?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "No account found for this email" },
      { status: 401 },
    );
  }

  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const sessionToken = await signToken({
    userId: user.id,
    email: user.email,
    role: "admin",
    name: user.name,
  });

  const response = NextResponse.json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  response.cookies.set("token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
