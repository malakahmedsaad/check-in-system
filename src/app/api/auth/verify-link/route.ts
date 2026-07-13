// Purpose: Verifies OTP codes and creates authenticated sessions for students or mentors.

import { NextResponse } from "next/server";

import { signToken } from "../../../../../lib/auth";
import { verifyOtp } from "../../../../../lib/otp";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; code?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 },
    );
  }

  const verification = await verifyOtp(email, code);

  if (verification === "locked") {
    return NextResponse.json(
      { error: "Too many incorrect attempts. Request a new code." },
      { status: 423 },
    );
  }

  if (verification === "expired") {
    return NextResponse.json(
      { error: "This code has expired. Request a new code." },
      { status: 401 },
    );
  }

  if (verification !== "valid") {
    return NextResponse.json(
      { error: "This code is invalid" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.role === "admin") {
    return NextResponse.json(
      { error: "This code is invalid" },
      { status: 401 },
    );
  }

  const sessionToken = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
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
