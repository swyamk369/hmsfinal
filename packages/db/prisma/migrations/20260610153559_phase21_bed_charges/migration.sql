-- AlterTable
ALTER TABLE "admission" ADD COLUMN     "bed_charged_through" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "hospital_settings" ADD COLUMN     "ipd_charge_admission_day" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ipd_charge_discharge_day" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ipd_day_basis" TEXT NOT NULL DEFAULT 'CALENDAR_DAY',
ADD COLUMN     "ipd_min_units" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ward" ADD COLUMN     "charge_catalog_id" UUID,
ADD COLUMN     "daily_rate" INTEGER NOT NULL DEFAULT 0;
