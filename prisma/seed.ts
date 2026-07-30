// Kiosk-only seed — creates app-specific records only.
// User, Booking, and Timeslot data lives in OS4's database.

import crypto from "crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const kioskStatusId = "singleton";

async function main() {
  await prisma.kioskStatus.upsert({
    where: { id: kioskStatusId },
    update: {},
    create: {
      id: kioskStatusId,
      isOpen: false,
    },
  });

  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    throw new Error("ADMIN_PIN is required to seed the database");
  }

  const adminPinSalt = crypto.randomBytes(16).toString("hex");
  const adminPinHash = crypto
    .scryptSync(adminPin, adminPinSalt, 64)
    .toString("hex");
  await prisma.appSetting.upsert({
    where: { id: "admin" },
    update: {},
    create: {
      id: "admin",
      adminPinHash,
      adminPinSalt,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
