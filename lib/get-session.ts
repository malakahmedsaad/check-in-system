// Purpose: Reads the auth cookie, verifies the JWT, and loads the current user from Prisma.

import { cookies } from "next/headers";

import { verifyToken } from "./auth";
import { os4Prisma } from "./os4-prisma";
import { translateRole } from "./os4-role";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  const session = await verifyToken(token);

  if (!session) {
    return null;
  }

  const user = await os4Prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user || translateRole(user.role) !== session.role) {
    return null;
  }

  return {
    userId: session.userId,
    email: user.email,
    role: translateRole(user.role),
    name: user.name,
  };
}
