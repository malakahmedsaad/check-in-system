ALTER TABLE "KioskStatus"
ADD CONSTRAINT "KioskStatus_singleton_id_check"
CHECK ("id" = 'singleton');
