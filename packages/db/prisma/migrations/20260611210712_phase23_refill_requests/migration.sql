-- CreateEnum
CREATE TYPE "RefillStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'DISPENSED');

-- CreateTable
CREATE TABLE "prescription_refill_request" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescription_id" UUID,
    "uid" TEXT NOT NULL,
    "status" "RefillStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "staffNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_refill_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_refill_request_tenant_id_status_idx" ON "prescription_refill_request"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "prescription_refill_request_tenant_id_patient_id_idx" ON "prescription_refill_request"("tenant_id", "patient_id");
