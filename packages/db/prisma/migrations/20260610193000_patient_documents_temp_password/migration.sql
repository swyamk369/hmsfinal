-- Patient document vault and temporary-password tracking.

CREATE TYPE "PatientDocumentCategory" AS ENUM (
  'CLINICAL',
  'BILLING',
  'INSURANCE',
  'CONSENT',
  'LAB',
  'DISCHARGE',
  'GENERATED_REPORT',
  'OTHER'
);

CREATE TYPE "PatientDocumentSource" AS ENUM (
  'UPLOADED',
  'EXTERNAL',
  'GENERATED'
);

ALTER TABLE "tenant_user"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "patient_document" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "category" "PatientDocumentCategory" NOT NULL DEFAULT 'OTHER',
  "source" "PatientDocumentSource" NOT NULL DEFAULT 'EXTERNAL',
  "mimeType" TEXT,
  "fileName" TEXT,
  "documentUrl" TEXT NOT NULL,
  "notes" TEXT,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "patient_document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patient_document_tenant_id_idx" ON "patient_document"("tenant_id");
CREATE INDEX "patient_document_patientId_idx" ON "patient_document"("patientId");

ALTER TABLE "patient_document"
  ADD CONSTRAINT "patient_document_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
