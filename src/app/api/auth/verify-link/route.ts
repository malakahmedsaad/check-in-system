import { NextResponse } from "next/server";

import { signToken } from "../../../../../lib/auth";
import { verifyMagicLinkToken } from "../../../../../lib/magic-link";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  let body: { token?: unknown };

  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const verification = await verifyMagicLinkToken(token);

  if (!verification) {
    return NextResponse.json(
      { error: "This link is invalid or has expired" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: verification.email },
  });

  if (!user || user.role === "admin") {
    return NextResponse.json(
      { error: "This link is invalid or has expired" },
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
