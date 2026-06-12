-- Add the platform support flag used by AuthMiddleware and support access checks.
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "isSupport" BOOLEAN NOT NULL DEFAULT false;
