CREATE TABLE "AppSetting" (
  "id" TEXT NOT NULL,
  "adminPinHash" TEXT NOT NULL,
  "adminPinSalt" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
