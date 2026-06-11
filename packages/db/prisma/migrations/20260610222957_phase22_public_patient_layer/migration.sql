-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ADMIN', 'PHONE', 'WALK_IN', 'ONLINE_BOOKING');

-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('IN_PERSON', 'TELEHEALTH');

-- CreateEnum
CREATE TYPE "AppointmentTypeConsult" AS ENUM ('IN_PERSON', 'TELEHEALTH', 'BOTH');

-- CreateEnum
CREATE TYPE "PublicProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PortalAccessStatus" AS ENUM ('ACTIVE', 'PENDING', 'BLOCKED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PortalVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingApprovalMode" AS ENUM ('AUTOMATIC', 'MANUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "AvailabilityOverrideType" AS ENUM ('UNAVAILABLE', 'EXTRA_AVAILABLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "OnlineBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OnlineBookingApproval" AS ENUM ('AUTO_CONFIRMED', 'PENDING_STAFF_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PatientAuthStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "SearchIndexType" AS ENUM ('HOSPITAL', 'DOCTOR', 'SERVICE');

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "appointment_type_id" UUID,
ADD COLUMN     "consultation_type" "ConsultationType" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "location_id" UUID,
ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "patient" ADD COLUMN     "linked_portal_uid" TEXT;

-- AlterTable
ALTER TABLE "patient_document" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" UUID,
ADD COLUMN     "patientViewedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" UUID,
ADD COLUMN     "visible_to_patient" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "patient_auth_user" (
    "id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "displayName" TEXT,
    "profilePhotoUrl" TEXT,
    "authProvider" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "PatientAuthStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "patient_auth_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_access" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "uid" TEXT NOT NULL,
    "patientId" UUID NOT NULL,
    "hospitalDisplayName" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "verificationStatus" "PortalVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "accessStatus" "PortalAccessStatus" NOT NULL DEFAULT 'PENDING',
    "linkedById" UUID,
    "linkedAt" TIMESTAMP(3),
    "blockReason" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_portal_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_hospital_profile" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hospitalSlug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hospitalDisplayName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "openingHours" JSONB,
    "facilities" TEXT[],
    "specialties" TEXT[],
    "services" TEXT[],
    "consultationTypes" TEXT[],
    "insuranceAccepted" TEXT[],
    "languages" TEXT[],
    "profileStatus" "PublicProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_hospital_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_doctor_profile" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "doctorSlug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "specialty" TEXT,
    "subSpecialties" TEXT[],
    "qualifications" TEXT,
    "registrationNumber" TEXT,
    "bio" TEXT,
    "languages" TEXT[],
    "gender" TEXT,
    "services" TEXT[],
    "consultationTypes" TEXT[],
    "locationIds" TEXT[],
    "fees" JSONB,
    "acceptsNewPatients" BOOLEAN NOT NULL DEFAULT true,
    "acceptsExistingPatients" BOOLEAN NOT NULL DEFAULT true,
    "telehealthAvailable" BOOLEAN NOT NULL DEFAULT false,
    "profileStatus" "PublicProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_doctor_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_location" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "openingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_type" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "consultationType" "AppointmentTypeConsult" NOT NULL DEFAULT 'IN_PERSON',
    "availableForNewPatients" BOOLEAN NOT NULL DEFAULT true,
    "availableForExistingPatients" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "locationId" UUID,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 15,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "consultationTypes" TEXT[],
    "appointmentTypeIds" TEXT[],
    "maxBookingsPerSlot" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_override" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "locationId" UUID,
    "date" DATE NOT NULL,
    "type" "AvailabilityOverrideType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "clinicDisplayName" TEXT,
    "clinicLogoUrl" TEXT,
    "primaryColor" TEXT,
    "publicContactNumber" TEXT,
    "publicEmail" TEXT,
    "address" TEXT,
    "bookingTerms" TEXT,
    "cancellationPolicy" TEXT,
    "privacyNotice" TEXT,
    "allowNewPatientBookings" BOOLEAN NOT NULL DEFAULT true,
    "allowExistingPatientBookings" BOOLEAN NOT NULL DEFAULT true,
    "bookingApprovalMode" "BookingApprovalMode" NOT NULL DEFAULT 'MANUAL',
    "minimumBookingNoticeHours" INTEGER NOT NULL DEFAULT 2,
    "maximumBookingAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_portal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_search_index" (
    "id" UUID NOT NULL,
    "type" "SearchIndexType" NOT NULL,
    "tenant_id" UUID NOT NULL,
    "doctorId" UUID,
    "hospitalSlug" TEXT,
    "doctorSlug" TEXT,
    "hospitalName" TEXT NOT NULL,
    "doctorName" TEXT,
    "specialty" TEXT,
    "services" TEXT[],
    "location" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "consultationTypes" TEXT[],
    "languages" TEXT[],
    "fees" INTEGER,
    "nextAvailableSlot" TIMESTAMP(3),
    "isBookable" BOOLEAN NOT NULL DEFAULT false,
    "profileUrl" TEXT,
    "searchKeywords" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_booking" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID,
    "uid" TEXT,
    "doctorId" UUID NOT NULL,
    "locationId" UUID,
    "appointmentTypeId" UUID,
    "appointmentId" UUID,
    "appointmentDate" DATE NOT NULL,
    "appointmentTime" TEXT NOT NULL,
    "consultationType" "ConsultationType" NOT NULL DEFAULT 'IN_PERSON',
    "reasonForVisit" TEXT,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "email" TEXT,
    "mobile" TEXT,
    "newOrExistingPatient" TEXT NOT NULL DEFAULT 'NEW',
    "bookingStatus" "OnlineBookingStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus" "OnlineBookingApproval" NOT NULL DEFAULT 'PENDING_STAFF_APPROVAL',
    "source" TEXT NOT NULL DEFAULT 'ONLINE_BOOKING',
    "possibleDuplicatePatient" BOOLEAN NOT NULL DEFAULT false,
    "duplicatePatientIds" TEXT[],
    "staffNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_auth_user_uid_key" ON "patient_auth_user"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "patient_auth_user_email_key" ON "patient_auth_user"("email");

-- CreateIndex
CREATE INDEX "patient_portal_access_tenant_id_idx" ON "patient_portal_access"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_portal_access_uid_idx" ON "patient_portal_access"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "patient_portal_access_tenant_id_uid_patientId_key" ON "patient_portal_access"("tenant_id", "uid", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "public_hospital_profile_tenant_id_key" ON "public_hospital_profile"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_hospital_profile_hospitalSlug_key" ON "public_hospital_profile"("hospitalSlug");

-- CreateIndex
CREATE INDEX "public_hospital_profile_tenant_id_idx" ON "public_hospital_profile"("tenant_id");

-- CreateIndex
CREATE INDEX "public_doctor_profile_tenant_id_idx" ON "public_doctor_profile"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_doctor_profile_tenant_id_doctorId_key" ON "public_doctor_profile"("tenant_id", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "public_doctor_profile_tenant_id_doctorSlug_key" ON "public_doctor_profile"("tenant_id", "doctorSlug");

-- CreateIndex
CREATE INDEX "hospital_location_tenant_id_idx" ON "hospital_location"("tenant_id");

-- CreateIndex
CREATE INDEX "appointment_type_tenant_id_idx" ON "appointment_type"("tenant_id");

-- CreateIndex
CREATE INDEX "availability_rule_tenant_id_idx" ON "availability_rule"("tenant_id");

-- CreateIndex
CREATE INDEX "availability_rule_doctorId_idx" ON "availability_rule"("doctorId");

-- CreateIndex
CREATE INDEX "availability_override_tenant_id_idx" ON "availability_override"("tenant_id");

-- CreateIndex
CREATE INDEX "availability_override_doctorId_idx" ON "availability_override"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_portal_settings_tenant_id_key" ON "patient_portal_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "public_search_index_type_idx" ON "public_search_index"("type");

-- CreateIndex
CREATE INDEX "public_search_index_tenant_id_idx" ON "public_search_index"("tenant_id");

-- CreateIndex
CREATE INDEX "public_search_index_city_idx" ON "public_search_index"("city");

-- CreateIndex
CREATE INDEX "online_booking_tenant_id_idx" ON "online_booking"("tenant_id");

-- CreateIndex
CREATE INDEX "online_booking_bookingStatus_idx" ON "online_booking"("bookingStatus");
