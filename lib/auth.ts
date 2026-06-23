import { SignJWT, jwtVerify } from "jose";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: string;
  name: string;
  isAdmin: boolean;
};

const encoder = new TextEncoder();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return encoder.encode(secret);
}

function isAuthTokenPayload(payload: unknown): payload is AuthTokenPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.userId === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.isAdmin === "boolean"
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

    if (!isAuthTokenPayload(payload)) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      isAdmin: payload.isAdmin,
    };
  } catch {
    return null;
  }
}
