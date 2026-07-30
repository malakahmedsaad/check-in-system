// Purpose: Signs and verifies JWT authentication tokens.

import { SignJWT, jwtVerify } from "jose";

export type AuthTokenPayload = {
  userId: number;
  email: string;
  role: string;
  name: string;
};

const encoder = new TextEncoder();
const MIN_JWT_SECRET_LENGTH = 32;
const validRoles = new Set(["student", "mentor", "admin"]);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  return encoder.encode(secret);
}

function isAuthTokenClaims(payload: unknown): payload is AuthTokenPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.userId === "number" &&
    typeof candidate.email === "string" &&
    typeof candidate.role === "string" &&
    validRoles.has(candidate.role) &&
    typeof candidate.name === "string"
  );
}

export async function signToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getJwtSecret());
}

export async function verifyToken(
  token: string,
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    if (!isAuthTokenClaims(payload)) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
