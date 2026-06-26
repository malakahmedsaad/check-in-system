-- Collapse kiosk state to the deterministic singleton row used by the app.
UPDATE "KioskStatus"
SET "id" = 'singleton'
WHERE "id" = (
    SELECT "id"
    FROM "KioskStatus"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "KioskStatus"
    WHERE "id" = 'singleton'
  );

DELETE FROM "KioskStatus"
WHERE "id" <> 'singleton';

-- A mentor can have many historical shifts, but only one open shift.
CREATE UNIQUE INDEX "Shift_one_active_shift_per_mentor"
ON "Shift"("mentorId")
WHERE "clockOutAt" IS NULL;
