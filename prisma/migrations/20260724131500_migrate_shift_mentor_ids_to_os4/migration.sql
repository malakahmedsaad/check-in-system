-- Preserve the original local User IDs so legacy timesheets remain auditable.
ALTER TABLE "Shift"
ADD COLUMN "legacyMentorId" TEXT;

UPDATE "Shift"
SET "legacyMentorId" = "mentorId";

-- OS4 user IDs are integers. Build the replacement column separately so
-- historical CUID-based shifts can be retained instead of deleted.
ALTER TABLE "Shift"
ADD COLUMN "os4MentorId" INTEGER;

UPDATE "Shift"
SET "os4MentorId" = CAST("mentorId" AS INTEGER)
WHERE "mentorId" ~ '^[0-9]+$';

WITH legacy_mentors AS (
  SELECT
    "mentorId",
    -ROW_NUMBER() OVER (ORDER BY "mentorId")::INTEGER AS "localId"
  FROM (
    SELECT DISTINCT "mentorId"
    FROM "Shift"
    WHERE "mentorId" !~ '^[0-9]+$'
  ) AS distinct_legacy_mentors
)
UPDATE "Shift" AS shift
SET "os4MentorId" = legacy_mentors."localId"
FROM legacy_mentors
WHERE shift."mentorId" = legacy_mentors."mentorId";

ALTER TABLE "Shift"
ALTER COLUMN "os4MentorId" SET NOT NULL;

ALTER TABLE "Shift"
DROP CONSTRAINT IF EXISTS "Shift_mentorId_fkey";

DROP INDEX IF EXISTS "Shift_one_active_shift_per_mentor";

ALTER TABLE "Shift"
DROP COLUMN "mentorId";

ALTER TABLE "Shift"
RENAME COLUMN "os4MentorId" TO "mentorId";

CREATE UNIQUE INDEX "Shift_one_active_shift_per_mentor"
ON "Shift"("mentorId")
WHERE "clockOutAt" IS NULL;
