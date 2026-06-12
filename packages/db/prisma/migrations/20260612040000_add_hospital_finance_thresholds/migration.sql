-- Finance governance thresholds expected by HospitalSettings.
ALTER TABLE "hospital_settings"
  ADD COLUMN IF NOT EXISTS "discount_approval_threshold" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "refund_approval_threshold" INTEGER NOT NULL DEFAULT 500000;
