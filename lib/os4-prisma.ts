import { PrismaClient } from "../node_modules/.prisma/os4-client";
import { validateEnv } from "./env-check";

validateEnv();

const globalForOs4 = globalThis as unknown as { os4Prisma: PrismaClient };

export const os4Prisma =
  globalForOs4.os4Prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForOs4.os4Prisma = os4Prisma;

// READ-ONLY CLIENT — permitted methods only:
// .findUnique() .findFirst() .findMany() .count() .aggregate()
// ALL WRITE OPERATIONS ARE FORBIDDEN on this client.
