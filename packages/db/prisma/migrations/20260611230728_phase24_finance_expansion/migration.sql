-- CreateEnum
CREATE TYPE "AdvanceDepositStatus" AS ENUM ('COLLECTED', 'CONSUMED', 'REFUNDED');

-- AlterTable
ALTER TABLE "billable_charge" ADD COLUMN     "package_id" UUID;

-- CreateTable
CREATE TABLE "price_list" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_list_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fixedPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package_item" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "service_package_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_deposit" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "admission_id" UUID,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "transactionId" TEXT,
    "status" "AdvanceDepositStatus" NOT NULL DEFAULT 'COLLECTED',
    "consumed_bill_id" UUID,
    "notes" TEXT,
    "collectedById" UUID,
    "refundedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_deposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_list_tenant_id_idx" ON "price_list"("tenant_id");

-- CreateIndex
CREATE INDEX "price_list_item_tenant_id_idx" ON "price_list_item"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_item_tenant_id_price_list_id_catalog_id_key" ON "price_list_item"("tenant_id", "price_list_id", "catalog_id");

-- CreateIndex
CREATE INDEX "service_package_tenant_id_idx" ON "service_package"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_package_tenant_id_code_key" ON "service_package"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "service_package_item_tenant_id_idx" ON "service_package_item"("tenant_id");

-- CreateIndex
CREATE INDEX "service_package_item_package_id_idx" ON "service_package_item"("package_id");

-- CreateIndex
CREATE INDEX "advance_deposit_tenant_id_idx" ON "advance_deposit"("tenant_id");

-- CreateIndex
CREATE INDEX "advance_deposit_patient_id_idx" ON "advance_deposit"("patient_id");

-- CreateIndex
CREATE INDEX "advance_deposit_admission_id_idx" ON "advance_deposit"("admission_id");

-- CreateIndex
CREATE INDEX "advance_deposit_status_idx" ON "advance_deposit"("status");

-- AddForeignKey
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "service_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_package_item" ADD CONSTRAINT "service_package_item_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_package_item" ADD CONSTRAINT "service_package_item_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "service_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_deposit" ADD CONSTRAINT "advance_deposit_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_deposit" ADD CONSTRAINT "advance_deposit_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billable_charge" ADD CONSTRAINT "billable_charge_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
