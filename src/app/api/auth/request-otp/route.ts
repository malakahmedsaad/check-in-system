// Purpose: Sends an OTP code to a student or mentor for sign-in.

import { NextResponse } from "next/server";

import { sendOtpEmail } from "../../../../../lib/email";
import { generateOtp } from "../../../../../lib/otp";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email address" },
        { status: 401 },
      );
    }

    if (user.role === "admin") {
      return NextResponse.json(
        { error: "Use the staff login instead" },
        { status: 403 },
      );
    }

    const code = await generateOtp(email);
    await sendOtpEmail({ to: email, name: user.name, code });

    return NextResponse.json({
      success: true,
      message: "A 4-digit code has been sent to your email",
    });
  } catch (error) {
    console.error("Failed to send OTP:", error);
    return NextResponse.json(
      { error: "Failed to send code. Please try again." },
      { status: 500 },
    );
  }
}
