-- Preserve the existing admin-flagged user as an admin role before dropping the flag.
-- This app expects a single admin user.
UPDATE "User"
SET "role" = 'admin'::"Role"
WHERE "isAdmin" = true;

-- Remove the legacy admin flag now that admin is represented by User.role.
ALTER TABLE "User" DROP COLUMN "isAdmin";

-- Magic link tokens are created when a user requests a login link.
-- They expire 15 minutes after creation and are marked usedAt when redeemed.
CREATE TABLE "MagicLinkToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MagicLinkToken_token_key" ON "MagicLinkToken"("token");

-- Questionnaire-only guests are a standalone log table and are not User records.
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);
