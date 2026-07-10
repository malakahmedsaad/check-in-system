// Purpose: Creates and redeems one-time magic-link login tokens.

import crypto from "crypto";

import { prisma } from "./prisma";

const MAGIC_LINK_EXPIRY_MINUTES = 15;

export async function generateMagicLinkToken(email: string): Promise<string> {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000,
  );

  await prisma.magicLinkToken.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lte: now,
          },
        },
        {
          usedAt: {
            not: null,
          },
        },
      ],
    },
  });

  await prisma.magicLinkToken.create({
    data: {
      email,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function verifyMagicLinkToken(
  token: string,
): Promise<{ email: string } | null> {
  const now = new Date();
  const magicLinkToken = await prisma.magicLinkToken.findUnique({
    where: { token },
  });

  if (
    !magicLinkToken ||
    magicLinkToken.usedAt ||
    magicLinkToken.expiresAt <= now
  ) {
    return null;
  }

  const update = await prisma.magicLinkToken.updateMany({
    where: {
      id: magicLinkToken.id,
      usedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    data: {
      usedAt: now,
    },
  });

  if (update.count !== 1) {
    return null;
  }

  return { email: magicLinkToken.email };
}
