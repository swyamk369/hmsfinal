-- Make per-doctor online booking OPT-OUT.
--
-- The hospital "Online booking enabled" + patient-portal switches are the master
-- control. Previously each PublicDoctorProfile defaulted to bookingEnabled=false,
-- so enabling booking at the hospital level had no effect until every doctor was
-- toggled on individually. We flip the default to true and opt in existing
-- published doctors so the master switches govern. Admins can still disable an
-- individual doctor from the Public Site → Doctors tab.

ALTER TABLE "public_doctor_profile" ALTER COLUMN "bookingEnabled" SET DEFAULT true;

-- One-time opt-in of existing rows that were left at the old default.
UPDATE "public_doctor_profile" SET "bookingEnabled" = true WHERE "bookingEnabled" = false;
