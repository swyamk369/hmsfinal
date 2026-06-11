-- CreateEnum
CREATE TYPE "PatientNotificationCategory" AS ENUM ('BOOKING', 'DOCUMENT', 'BILLING', 'REFILL', 'GENERAL');

-- AlterTable
ALTER TABLE "patient_auth_user" ADD COLUMN     "notifyBilling" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyBookingUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyDocuments" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "patient_saved_provider" (
    "id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "doctorSlug" TEXT,
    "doctorName" TEXT NOT NULL,
    "specialty" TEXT,
    "hospitalName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_saved_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_saved_hospital" (
    "id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hospitalSlug" TEXT,
    "hospitalName" TEXT NOT NULL,
    "city" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_saved_hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_family_member" (
    "id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "sex" TEXT,
    "mobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_family_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_notification" (
    "id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "tenant_id" UUID,
    "category" "PatientNotificationCategory" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actionUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_saved_provider_uid_idx" ON "patient_saved_provider"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "patient_saved_provider_uid_tenant_id_doctor_id_key" ON "patient_saved_provider"("uid", "tenant_id", "doctor_id");

-- CreateIndex
CREATE INDEX "patient_saved_hospital_uid_idx" ON "patient_saved_hospital"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "patient_saved_hospital_uid_tenant_id_key" ON "patient_saved_hospital"("uid", "tenant_id");

-- CreateIndex
CREATE INDEX "patient_family_member_uid_idx" ON "patient_family_member"("uid");

-- CreateIndex
CREATE INDEX "patient_notification_uid_idx" ON "patient_notification"("uid");

-- CreateIndex
CREATE INDEX "patient_notification_uid_readAt_idx" ON "patient_notification"("uid", "readAt");

-- AddForeignKey
ALTER TABLE "patient_saved_provider" ADD CONSTRAINT "patient_saved_provider_uid_fkey" FOREIGN KEY ("uid") REFERENCES "patient_auth_user"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_saved_hospital" ADD CONSTRAINT "patient_saved_hospital_uid_fkey" FOREIGN KEY ("uid") REFERENCES "patient_auth_user"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_family_member" ADD CONSTRAINT "patient_family_member_uid_fkey" FOREIGN KEY ("uid") REFERENCES "patient_auth_user"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_notification" ADD CONSTRAINT "patient_notification_uid_fkey" FOREIGN KEY ("uid") REFERENCES "patient_auth_user"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
