import { NextResponse } from "next/server";

import { sendMagicLinkEmail } from "../../../../../lib/email";
import { generateMagicLinkToken } from "../../../../../lib/magic-link";
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

  const token = await generateMagicLinkToken(email);
  const clientUrl = process.env.CLIENT_URL ?? new URL(request.url).origin;
  const link = `${clientUrl}/auth/verify?token=${token}`;

  try {
    await sendMagicLinkEmail({
      to: user.email,
      name: user.name,
      link,
    });
  } catch (error) {
    console.error("Magic link email failed:", error);
  }

  return NextResponse.json({
    success: true,
    message: "Check your email for a sign-in link",
  });
}
