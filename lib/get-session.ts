// Purpose: Reads the auth cookie, verifies the JWT, and loads the current user from Prisma.

import { cookies } from "next/headers";

import { verifyToken } from "./auth";
import { prisma } from "./prisma";

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

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user || user.role !== session.role) {
    return null;
  }

  return {
    userId: session.userId,
    email: user.email,
    role: user.role,
    name: user.name,
  };
}
