// Purpose: Starts non-admin sign-in by creating and emailing an OTP code.

import { NextResponse } from "next/server";

import { sendOtpEmail } from "../../../../../lib/email";
import { generateOtp } from "../../../../../lib/otp";
import { prisma } from "../../../../../lib/prisma";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: unknown };

  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "No account found for this email" },
      { status: 401 },
    );
  }

  if (user.role === "admin") {
    return NextResponse.json(
      { error: "Admin login uses a different method" },
      { status: 403 },
    );
  }

  const code = await generateOtp(email);

  try {
    await sendOtpEmail({
      to: user.email,
      name: user.name,
      code,
    });
  } catch (error) {
    console.error("OTP email failed:", error);
  }

  return NextResponse.json({
    success: true,
    message: "Check your email for a sign-in code",
  });
}
