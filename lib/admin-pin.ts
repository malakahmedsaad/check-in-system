// Purpose: Verifies and updates the stored admin PIN hash.

import crypto from "crypto";

import { prisma } from "./prisma";

const ADMIN_SETTINGS_ID = "admin";
const PIN_HASH_KEY_LENGTH = 64;

function getFallbackAdminPin() {
  const pin = process.env.ADMIN_PIN;

  if (!pin) {
    throw new Error("ADMIN_PIN is not configured");
  }

  return pin;
}

function hashPin(pin: string, salt: string) {
  return crypto.scryptSync(pin, salt, PIN_HASH_KEY_LENGTH).toString("hex");
}

function timingSafeMatches(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

export async function verifyAdminPin(pin: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { id: ADMIN_SETTINGS_ID },
  });

  if (!setting) {
    return timingSafeMatches(pin, getFallbackAdminPin());
  }

  return timingSafeMatches(
    hashPin(pin, setting.adminPinSalt),
    setting.adminPinHash,
  );
}

export async function updateAdminPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const adminPinHash = hashPin(pin, salt);

  await prisma.appSetting.upsert({
    where: { id: ADMIN_SETTINGS_ID },
    update: {
      adminPinHash,
      adminPinSalt: salt,
    },
    create: {
      id: ADMIN_SETTINGS_ID,
      adminPinHash,
      adminPinSalt: salt,
    },
  });
}
