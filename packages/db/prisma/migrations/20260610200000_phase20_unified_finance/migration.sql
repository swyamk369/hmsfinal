-- Phase 20 — Unified Finance And Revenue Cycle

CREATE TYPE "BillableChargeSourceModule" AS ENUM ('OPD', 'LAB', 'PHARMACY', 'IPD', 'MANUAL', 'INSURANCE');
CREATE TYPE "BillableChargeStatus" AS ENUM ('PENDING', 'BILLED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "FinanceDayCloseStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');
CREATE TYPE "FinanceApprovalType" AS ENUM ('REFUND', 'DISCOUNT', 'WRITE_OFF', 'BILL_CANCEL', 'DAY_CLOSE_REOPEN', 'DISCHARGE_OVERRIDE');
CREATE TYPE "FinanceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "billable_charge" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "encounterId" UUID,
  "admissionId" UUID,
  "billId" UUID,
  "billItemId" UUID,
  "catalogId" UUID,
  "sourceModule" "BillableChargeSourceModule" NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" UUID,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "status" "BillableChargeStatus" NOT NULL DEFAULT 'PENDING',
  "cancellationReason" TEXT,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billable_charge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance_day_close" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "cashierId" UUID,
  "status" "FinanceDayCloseStatus" NOT NULL DEFAULT 'CLOSED',
  "cashTotal" INTEGER NOT NULL DEFAULT 0,
  "cardTotal" INTEGER NOT NULL DEFAULT 0,
  "upiTotal" INTEGER NOT NULL DEFAULT 0,
  "bankTotal" INTEGER NOT NULL DEFAULT 0,
  "insuranceTotal" INTEGER NOT NULL DEFAULT 0,
  "otherTotal" INTEGER NOT NULL DEFAULT 0,
  "refundTotal" INTEGER NOT NULL DEFAULT 0,
  "cancellationTotal" INTEGER NOT NULL DEFAULT 0,
  "netCollection" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closedById" UUID,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reopenedById" UUID,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  CONSTRAINT "finance_day_close_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance_approval" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "type" "FinanceApprovalType" NOT NULL,
  "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER,
  "entity" TEXT NOT NULL,
  "entityId" UUID,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "requestedById" UUID,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" UUID,
  "decidedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "metadata" JSONB,
  CONSTRAINT "finance_approval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billable_charge_tenant_id_idx" ON "billable_charge"("tenant_id");
CREATE INDEX "billable_charge_patientId_idx" ON "billable_charge"("patientId");
CREATE INDEX "billable_charge_billId_idx" ON "billable_charge"("billId");
CREATE INDEX "billable_charge_status_idx" ON "billable_charge"("status");
CREATE INDEX "billable_charge_sourceModule_sourceId_idx" ON "billable_charge"("sourceModule", "sourceId");

CREATE INDEX "finance_day_close_tenant_id_idx" ON "finance_day_close"("tenant_id");
CREATE INDEX "finance_day_close_businessDate_idx" ON "finance_day_close"("businessDate");

CREATE INDEX "finance_approval_tenant_id_idx" ON "finance_approval"("tenant_id");
CREATE INDEX "finance_approval_status_idx" ON "finance_approval"("status");
CREATE INDEX "finance_approval_type_idx" ON "finance_approval"("type");
