// Purpose: Handles public guest check-in submissions.

import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/prisma";

type GuestField = "name" | "email" | "purpose";
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PURPOSE_LENGTH = 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(field: GuestField, error: string) {
  return NextResponse.json({ field, error }, { status: 400 });
}

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; purpose?: unknown };

  try {
    body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      purpose?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const purpose =
    typeof body.purpose === "string" ? body.purpose.trim() : "";

  if (!name) {
    return validationError("name", "Name is required");
  }

  if (name.length > MAX_NAME_LENGTH) {
    return validationError(
      "name",
      `Name must be ${MAX_NAME_LENGTH} characters or fewer`,
    );
  }

  if (!email) {
    return validationError("email", "Email is required");
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return validationError(
      "email",
      `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`,
    );
  }

  if (!emailPattern.test(email)) {
    return validationError("email", "Enter a valid email address");
  }

  if (!purpose) {
    return validationError("purpose", "Purpose of visit is required");
  }

  if (purpose.length > MAX_PURPOSE_LENGTH) {
    return validationError(
      "purpose",
      `Purpose must be ${MAX_PURPOSE_LENGTH} characters or fewer`,
    );
  }

  const guest = await prisma.guest.create({
    data: {
      name,
      email,
      purpose,
    },
  });

  return NextResponse.json(guest, { status: 201 });
}
