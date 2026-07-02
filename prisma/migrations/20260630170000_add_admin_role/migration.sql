-- Add admin as a standalone role. The value is used in the next migration after commit.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'admin';
