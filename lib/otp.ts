// Purpose: Generates and verifies short-lived email OTP sign-in codes.

import { prisma } from "./prisma";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

export async function generateOtp(email: string): Promise<string> {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.deleteMany({
    where: {
      email,
      usedAt: null,
    },
  });

  await prisma.otpCode.create({
    data: {
      email,
      code,
      expiresAt,
    },
  });

  return code;
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<"valid" | "invalid" | "expired" | "locked"> {
  try {
    const otpCode = await prisma.otpCode.findFirst({
      where: {
        email,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpCode) {
      return "invalid";
    }

    if (otpCode.attempts >= MAX_OTP_ATTEMPTS) {
      return "locked";
    }

    if (otpCode.expiresAt <= new Date()) {
      return "expired";
    }

    if (otpCode.code !== code) {
      await prisma.otpCode.update({
        where: {
          id: otpCode.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      return "invalid";
    }

    await prisma.otpCode.update({
      where: {
        id: otpCode.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return "valid";
  } catch (error) {
    console.error("OTP verification failed:", error);
    return "invalid";
  }
}
