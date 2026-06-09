-- ─────────────────────────────────────────────────────────────
-- HMS SaaS — Row-Level Security + audit immutability.
-- Idempotent: safe to run repeatedly. Run as the DB owner/superuser
-- (DATABASE_URL).  pnpm db:rls  (or psql "$DATABASE_URL" -f sql/rls.sql)
-- ─────────────────────────────────────────────────────────────

-- 1. Non-owner application role. Because it is NOT the table owner and not a
--    superuser, FORCE ROW LEVEL SECURITY isolates every query it runs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
    CREATE ROLE hms_app LOGIN PASSWORD 'app_pw';
  ELSE
    ALTER ROLE hms_app LOGIN PASSWORD 'app_pw';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO hms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hms_app;

-- 2. Enable + FORCE RLS and attach a tenant-isolation policy to every
--    tenant-scoped table. The policy reads app.current_tenant_id, which
--    forTenant() sets (locally) on each transaction.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'subscription', 'module_entitlement',
    'tenant_user', 'provider',
    'facility', 'department', 'hospital_settings', 'service_catalog',
    'patient', 'patient_identifier', 'consent', 'medical_history', 'allergy',
    'appointment', 'encounter', 'vitals', 'diagnosis', 'clinical_note',
    'prescription', 'prescription_item',
    'nursing_note', 'medication_administration',
    'lab_test_catalog', 'lab_order', 'lab_order_item', 'lab_sample', 'lab_result',
    'inventory_item', 'supplier', 'inventory_batch', 'purchase_order',
    'purchase_order_item', 'inventory_transaction', 'dispense_record', 'dispense_item',
    'bill', 'bill_item', 'payment', 'refund',
    'ward', 'bed', 'admission', 'bed_transfer', 'ipd_round', 'ipd_charge', 'discharge_summary',
    'insurance_provider', 'patient_insurance_policy', 'insurance_claim', 'claim_settlement',
    'audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
      EXECUTE format($pol$
        CREATE POLICY tenant_isolation ON public.%I
          USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      $pol$, t);
    END IF;
  END LOOP;
END$$;

-- 3. Audit immutability: audit_log rows can be inserted but never changed or
--    deleted (even by the app role). The owner/superuser is also blocked by
--    this trigger, which is intentional.
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable';
END$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON public.audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
