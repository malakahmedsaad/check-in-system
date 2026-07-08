import { NextResponse } from "next/server";

import { verifyAdminPin } from "../../../../../lib/admin-pin";
import { signToken } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

const ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, {
      count: 1,
      resetAt: now + ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  return current.count > ADMIN_LOGIN_MAX_ATTEMPTS;
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: Request) {
  let body: { email?: unknown; pin?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; pin?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  if (!pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const rateLimitKey = `${clientIp}:${email.toLowerCase()}`;

  // SECURITY: Rate limits admin PIN attempts to make brute-force guessing impractical.
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "No account found for this email" },
      { status: 401 },
    );
  }

  if (!(await verifyAdminPin(pin))) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  clearRateLimit(rateLimitKey);

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
