// Purpose: Verifies an OTP and creates a student or mentor session.

import { NextResponse } from "next/server";

import { signToken } from "../../../../../lib/auth";
import { verifyOtp } from "../../../../../lib/otp";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      code?: unknown;
    };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 },
      );
    }

    const verification = await verifyOtp(email, code);

    if (verification === "invalid") {
      return NextResponse.json(
        { error: "Incorrect code. Please try again." },
        { status: 401 },
      );
    }

    if (verification === "expired") {
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 401 },
      );
    }

    if (verification === "locked") {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new code." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role === "admin") {
      return NextResponse.json(
        { error: "Incorrect code. Please try again." },
        { status: 401 },
      );
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const response = NextResponse.json({
      user: { name: user.name, email: user.email, role: user.role },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Failed to verify OTP:", error);
    return NextResponse.json(
      { error: "Failed to verify code. Please try again." },
      { status: 500 },
    );
  }
}
