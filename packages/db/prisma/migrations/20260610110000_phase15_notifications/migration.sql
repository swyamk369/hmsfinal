-- Phase 15 — tenant-scoped notification center, preferences, and delivery attempts.

CREATE TYPE "NotificationCategory" AS ENUM (
  'APPOINTMENT',
  'LAB',
  'BILLING',
  'PHARMACY',
  'INVENTORY',
  'INSURANCE',
  'IPD',
  'SYSTEM'
);

CREATE TYPE "NotificationSeverity" AS ENUM (
  'INFO',
  'SUCCESS',
  'WARNING',
  'CRITICAL'
);

CREATE TYPE "NotificationChannel" AS ENUM (
  'IN_APP',
  'EMAIL',
  'SMS',
  'WHATSAPP'
);

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

CREATE TABLE "notification" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "recipientUserId" UUID,
  "tenantUserId" UUID,
  "category" "NotificationCategory" NOT NULL,
  "type" TEXT NOT NULL,
  "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preference" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tenantUserId" UUID,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_delivery_attempt" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "errorMessage" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "notification_delivery_attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_tenant_id_idx" ON "notification"("tenant_id");
CREATE INDEX "notification_tenant_id_recipientUserId_readAt_idx" ON "notification"("tenant_id", "recipientUserId", "readAt");
CREATE INDEX "notification_tenant_id_category_idx" ON "notification"("tenant_id", "category");

CREATE UNIQUE INDEX "notification_preference_tenant_id_userId_category_key"
  ON "notification_preference"("tenant_id", "userId", "category");
CREATE INDEX "notification_preference_tenant_id_idx" ON "notification_preference"("tenant_id");

CREATE INDEX "notification_delivery_attempt_tenant_id_idx" ON "notification_delivery_attempt"("tenant_id");
CREATE INDEX "notification_delivery_attempt_notificationId_idx" ON "notification_delivery_attempt"("notificationId");

ALTER TABLE "notification_delivery_attempt"
  ADD CONSTRAINT "notification_delivery_attempt_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
