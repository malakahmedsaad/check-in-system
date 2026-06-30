import { NextResponse } from "next/server";

import { signToken } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  let body: { email?: unknown };

  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "No account found for this email" },
      { status: 401 },
    );
  }

  const isAdmin = user.role === "admin";

  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    isAdmin,
  });

  const response = NextResponse.json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin,
    },
  });

  response.cookies.set("token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
