-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_SETUP');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('PLAN', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('DOCTOR', 'NURSE', 'OTHER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('OPD', 'IPD', 'EMERGENCY', 'WALK_IN');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiagnosisType" AS ENUM ('PROVISIONAL', 'FINAL', 'DIFFERENTIAL');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('SOAP', 'PROGRESS', 'GENERAL');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'DISPENSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicationAdminStatus" AS ENUM ('ADMINISTERED', 'REFUSED', 'MISSED', 'HELD');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabItemStatus" AS ENUM ('ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AbnormalFlag" AS ENUM ('NORMAL', 'HIGH', 'LOW', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('DRUG', 'CONSUMABLE', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('STOCK_IN', 'DISPENSE', 'ADJUSTMENT', 'RETURN', 'EXPIRY');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispenseStatus" AS ENUM ('PENDING', 'DISPENSED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillSourceType" AS ENUM ('CONSULTATION', 'LAB', 'PHARMACY', 'IPD', 'PROCEDURE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "WardType" AS ENUM ('GENERAL', 'PRIVATE', 'ICU', 'HDU', 'MATERNITY', 'PEDIATRIC');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "tier" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "branding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceInr" INTEGER NOT NULL DEFAULT 0,
    "priceUsd" INTEGER NOT NULL DEFAULT 0,
    "interval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "userLimit" INTEGER,
    "facilityLimit" INTEGER,
    "bedLimit" INTEGER,
    "modules" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider" TEXT,
    "providerSubId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_entitlement" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscriptionId" UUID,
    "moduleCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" "EntitlementSource" NOT NULL DEFAULT 'PLAN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_log" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "tenant_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "isPlatform" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_user" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,

    CONSTRAINT "tenant_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemRole" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" UUID NOT NULL,
    "tenantUserId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "departmentId" UUID,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "departmentId" UUID,
    "type" "ProviderType" NOT NULL DEFAULT 'DOCTOR',
    "registrationNumber" TEXT,
    "speciality" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "facilityId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "mrnPrefix" TEXT NOT NULL DEFAULT 'MRN',
    "defaultConsultationCatalogId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mrn" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "sex" "Sex",
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "deletedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_identifier" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "patient_identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergy" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "substance" TEXT NOT NULL,
    "severity" TEXT,
    "notes" TEXT,

    CONSTRAINT "allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" UUID,
    "departmentId" UUID,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" UUID,
    "appointmentId" UUID,
    "departmentId" UUID,
    "type" "EncounterType" NOT NULL DEFAULT 'OPD',
    "status" "EncounterStatus" NOT NULL DEFAULT 'SCHEDULED',
    "chiefComplaint" TEXT,
    "tokenNumber" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "spo2" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "respiratoryRate" INTEGER,
    "notes" TEXT,
    "recordedById" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "icdCode" TEXT,
    "description" TEXT NOT NULL,
    "type" "DiagnosisType" NOT NULL DEFAULT 'PROVISIONAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_note" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "authorId" UUID,
    "noteType" "NoteType" NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "providerId" UUID,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "inventoryItemId" UUID,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "route" TEXT,
    "instructions" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "prescription_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_note" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "admissionId" UUID,
    "encounterId" UUID,
    "nurseId" UUID,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_administration" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "admissionId" UUID,
    "prescriptionItemId" UUID,
    "administeredById" UUID,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MedicationAdminStatus" NOT NULL DEFAULT 'ADMINISTERED',
    "notes" TEXT,

    CONSTRAINT "medication_administration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_catalog" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specimenType" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_test_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_order" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "admissionId" UUID,
    "providerId" UUID,
    "orderedById" UUID,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_order_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "labOrderId" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "testName" TEXT NOT NULL,
    "status" "LabItemStatus" NOT NULL DEFAULT 'ORDERED',

    CONSTRAINT "lab_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_sample" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "labOrderItemId" UUID NOT NULL,
    "barcode" TEXT,
    "collectedById" UUID,
    "collectedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'COLLECTED',

    CONSTRAINT "lab_sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "labOrderItemId" UUID NOT NULL,
    "testName" TEXT NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "referenceRange" TEXT,
    "abnormalFlag" "AbnormalFlag" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "enteredById" UUID,
    "verifiedById" UUID,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "lab_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryItemType" NOT NULL DEFAULT 'DRUG',
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "sku" TEXT,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batch" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "supplierId" UUID,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "salePrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "invoiceRef" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "batchId" UUID,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transaction" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "batchId" UUID,
    "type" "InventoryTxnType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_record" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "dispensedById" UUID,
    "status" "DispenseStatus" NOT NULL DEFAULT 'PENDING',
    "billId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispense_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dispenseRecordId" UUID NOT NULL,
    "prescriptionItemId" UUID,
    "inventoryItemId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "dispense_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "admissionId" UUID,
    "billNumber" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "catalogId" UUID,
    "sourceType" "BillSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" UUID,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bill_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "transactionId" TEXT,
    "collectedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "paymentId" UUID,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refundedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WardType" NOT NULL DEFAULT 'GENERAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "providerId" UUID,
    "bedId" UUID NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "dischargeReason" TEXT,
    "dischargeSummary" TEXT,
    "dischargeNotes" TEXT,
    "expectedDischargeAt" TIMESTAMP(3),

    CONSTRAINT "admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_transfer" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "fromBedId" UUID NOT NULL,
    "toBedId" UUID NOT NULL,
    "reason" TEXT,
    "transferredById" UUID,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_round" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "providerId" UUID,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipd_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_charge" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "catalogId" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" UUID,
    "billItemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipd_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_summary" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "instructions" TEXT,
    "followUpDate" TIMESTAMP(3),
    "preparedById" UUID,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discharge_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_provider" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_insurance_policy" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "coverageDetails" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_insurance_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claim" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "patientPolicyId" UUID NOT NULL,
    "providerId" UUID,
    "claimAmount" INTEGER NOT NULL DEFAULT 0,
    "approvedAmount" INTEGER,
    "patientShare" INTEGER,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_settlement" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "paymentId" UUID,
    "amount" INTEGER NOT NULL,
    "settledById" UUID,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "claim_settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plan_code_key" ON "plan"("code");

-- CreateIndex
CREATE INDEX "subscription_tenant_id_idx" ON "subscription"("tenant_id");

-- CreateIndex
CREATE INDEX "module_entitlement_tenant_id_idx" ON "module_entitlement"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_entitlement_tenant_id_moduleCode_key" ON "module_entitlement"("tenant_id", "moduleCode");

-- CreateIndex
CREATE INDEX "platform_audit_log_tenant_id_idx" ON "platform_audit_log"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_firebaseUid_key" ON "app_user"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "tenant_user_tenant_id_idx" ON "tenant_user"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_tenant_id_userId_key" ON "tenant_user"("tenant_id", "userId");

-- CreateIndex
CREATE INDEX "role_tenant_id_idx" ON "role"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_tenant_id_code_key" ON "role"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_key_key" ON "permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_tenantUserId_roleId_key" ON "user_role"("tenantUserId", "roleId");

-- CreateIndex
CREATE INDEX "provider_tenant_id_idx" ON "provider"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_tenant_id_userId_key" ON "provider"("tenant_id", "userId");

-- CreateIndex
CREATE INDEX "facility_tenant_id_idx" ON "facility"("tenant_id");

-- CreateIndex
CREATE INDEX "department_tenant_id_idx" ON "department"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_settings_tenant_id_key" ON "hospital_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "service_catalog_tenant_id_idx" ON "service_catalog"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_tenant_id_code_key" ON "service_catalog"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "patient_tenant_id_idx" ON "patient"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_tenant_id_mrn_key" ON "patient"("tenant_id", "mrn");

-- CreateIndex
CREATE INDEX "patient_identifier_tenant_id_idx" ON "patient_identifier"("tenant_id");

-- CreateIndex
CREATE INDEX "consent_tenant_id_idx" ON "consent"("tenant_id");

-- CreateIndex
CREATE INDEX "medical_history_tenant_id_idx" ON "medical_history"("tenant_id");

-- CreateIndex
CREATE INDEX "allergy_tenant_id_idx" ON "allergy"("tenant_id");

-- CreateIndex
CREATE INDEX "appointment_tenant_id_idx" ON "appointment"("tenant_id");

-- CreateIndex
CREATE INDEX "encounter_tenant_id_idx" ON "encounter"("tenant_id");

-- CreateIndex
CREATE INDEX "encounter_patientId_idx" ON "encounter"("patientId");

-- CreateIndex
CREATE INDEX "vitals_tenant_id_idx" ON "vitals"("tenant_id");

-- CreateIndex
CREATE INDEX "diagnosis_tenant_id_idx" ON "diagnosis"("tenant_id");

-- CreateIndex
CREATE INDEX "clinical_note_tenant_id_idx" ON "clinical_note"("tenant_id");

-- CreateIndex
CREATE INDEX "prescription_tenant_id_idx" ON "prescription"("tenant_id");

-- CreateIndex
CREATE INDEX "prescription_item_tenant_id_idx" ON "prescription_item"("tenant_id");

-- CreateIndex
CREATE INDEX "nursing_note_tenant_id_idx" ON "nursing_note"("tenant_id");

-- CreateIndex
CREATE INDEX "medication_administration_tenant_id_idx" ON "medication_administration"("tenant_id");

-- CreateIndex
CREATE INDEX "lab_test_catalog_tenant_id_idx" ON "lab_test_catalog"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_catalog_tenant_id_code_key" ON "lab_test_catalog"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "lab_order_tenant_id_idx" ON "lab_order"("tenant_id");

-- CreateIndex
CREATE INDEX "lab_order_patientId_idx" ON "lab_order"("patientId");

-- CreateIndex
CREATE INDEX "lab_order_item_tenant_id_idx" ON "lab_order_item"("tenant_id");

-- CreateIndex
CREATE INDEX "lab_sample_tenant_id_idx" ON "lab_sample"("tenant_id");

-- CreateIndex
CREATE INDEX "lab_result_tenant_id_idx" ON "lab_result"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_item_tenant_id_idx" ON "inventory_item"("tenant_id");

-- CreateIndex
CREATE INDEX "supplier_tenant_id_idx" ON "supplier"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_batch_tenant_id_idx" ON "inventory_batch"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_batch_itemId_idx" ON "inventory_batch"("itemId");

-- CreateIndex
CREATE INDEX "purchase_order_tenant_id_idx" ON "purchase_order"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_order_item_tenant_id_idx" ON "purchase_order_item"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_tenant_id_idx" ON "inventory_transaction"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_itemId_idx" ON "inventory_transaction"("itemId");

-- CreateIndex
CREATE INDEX "dispense_record_tenant_id_idx" ON "dispense_record"("tenant_id");

-- CreateIndex
CREATE INDEX "dispense_item_tenant_id_idx" ON "dispense_item"("tenant_id");

-- CreateIndex
CREATE INDEX "bill_tenant_id_idx" ON "bill"("tenant_id");

-- CreateIndex
CREATE INDEX "bill_patientId_idx" ON "bill"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_tenant_id_billNumber_key" ON "bill"("tenant_id", "billNumber");

-- CreateIndex
CREATE INDEX "bill_item_tenant_id_idx" ON "bill_item"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_tenant_id_idx" ON "payment"("tenant_id");

-- CreateIndex
CREATE INDEX "refund_tenant_id_idx" ON "refund"("tenant_id");

-- CreateIndex
CREATE INDEX "ward_tenant_id_idx" ON "ward"("tenant_id");

-- CreateIndex
CREATE INDEX "bed_tenant_id_idx" ON "bed"("tenant_id");

-- CreateIndex
CREATE INDEX "admission_tenant_id_idx" ON "admission"("tenant_id");

-- CreateIndex
CREATE INDEX "admission_patientId_idx" ON "admission"("patientId");

-- CreateIndex
CREATE INDEX "bed_transfer_tenant_id_idx" ON "bed_transfer"("tenant_id");

-- CreateIndex
CREATE INDEX "ipd_round_tenant_id_idx" ON "ipd_round"("tenant_id");

-- CreateIndex
CREATE INDEX "ipd_charge_tenant_id_idx" ON "ipd_charge"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_summary_admissionId_key" ON "discharge_summary"("admissionId");

-- CreateIndex
CREATE INDEX "discharge_summary_tenant_id_idx" ON "discharge_summary"("tenant_id");

-- CreateIndex
CREATE INDEX "insurance_provider_tenant_id_idx" ON "insurance_provider"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_insurance_policy_tenant_id_idx" ON "patient_insurance_policy"("tenant_id");

-- CreateIndex
CREATE INDEX "insurance_claim_tenant_id_idx" ON "insurance_claim"("tenant_id");

-- CreateIndex
CREATE INDEX "claim_settlement_tenant_id_idx" ON "claim_settlement"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_idx" ON "audit_log"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "audit_log"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "tenant_user" ADD CONSTRAINT "tenant_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "tenant_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_identifier" ADD CONSTRAINT "patient_identifier_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergy" ADD CONSTRAINT "allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis" ADD CONSTRAINT "diagnosis_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_item" ADD CONSTRAINT "prescription_item_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_order" ADD CONSTRAINT "lab_order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_order" ADD CONSTRAINT "lab_order_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_order_item" ADD CONSTRAINT "lab_order_item_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_sample" ADD CONSTRAINT "lab_sample_labOrderItemId_fkey" FOREIGN KEY ("labOrderItemId") REFERENCES "lab_order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result" ADD CONSTRAINT "lab_result_labOrderItemId_fkey" FOREIGN KEY ("labOrderItemId") REFERENCES "lab_order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batch" ADD CONSTRAINT "inventory_batch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batch" ADD CONSTRAINT "inventory_batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_item" ADD CONSTRAINT "dispense_item_dispenseRecordId_fkey" FOREIGN KEY ("dispenseRecordId") REFERENCES "dispense_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill" ADD CONSTRAINT "bill_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill" ADD CONSTRAINT "bill_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_item" ADD CONSTRAINT "bill_item_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer" ADD CONSTRAINT "bed_transfer_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_round" ADD CONSTRAINT "ipd_round_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_charge" ADD CONSTRAINT "ipd_charge_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance_policy" ADD CONSTRAINT "patient_insurance_policy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance_policy" ADD CONSTRAINT "patient_insurance_policy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "insurance_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claim" ADD CONSTRAINT "insurance_claim_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claim" ADD CONSTRAINT "insurance_claim_patientPolicyId_fkey" FOREIGN KEY ("patientPolicyId") REFERENCES "patient_insurance_policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_settlement" ADD CONSTRAINT "claim_settlement_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "insurance_claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
