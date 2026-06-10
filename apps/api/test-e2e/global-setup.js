/**
 * E2E global setup: fail fast if the stack is down, then make sure the two
 * test tenants exist and write a state file the suites read.
 *
 *  - Demo Hospital (ENTERPRISE, all modules) — provisioned by provision:demo.
 *  - E2E Clinic B (GROWTH) — provisioned HERE through the real platform API as
 *    the Super Admin (this doubles as the workflow-1 onboarding proof's fixture).
 *    Idempotent: found by slug, never recreated.
 */
const fs = require('node:fs');
const { loadE2eEnv, API_URL, WEB_URL, STATE_FILE } = require('./env');

const CLINIC_B = {
  name: 'E2E Clinic B',
  slug: 'e2e-clinic-b',
  planCode: 'GROWTH',
  adminEmail: 'e2e-admin@clinicb.local',
  adminName: 'E2E Clinic B Admin',
  adminPassword: 'E2e-2026!',
};
const DEMO_PASSWORD = 'Demo-2026!';

async function signIn(email, password) {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing — is apps/web/.env.local present?');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Firebase sign-in failed for ${email}: ${JSON.stringify(body.error ?? body)}`);
  return body.idToken;
}

async function api(token, tenantId, method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

module.exports = async function globalSetup() {
  loadE2eEnv();

  // 1. Stack must be up.
  const health = await fetch(`${API_URL}/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(`API is not reachable at ${API_URL}. Start the stack first (pnpm dev / services:up).`);
  }
  const web = await fetch(`${WEB_URL}/login`).catch(() => null);
  const webUp = !!(web && web.ok);

  // 2. Super Admin session.
  const saEmail = process.env.SUPERADMIN_EMAIL;
  const saPassword = process.env.SUPERADMIN_PASSWORD;
  if (!saEmail || !saPassword) throw new Error('SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD missing from apps/api/.env');
  const saToken = await signIn(saEmail, saPassword);

  // 3. Demo Hospital tenant id (via the demo admin's own membership).
  const demoAdminToken = await signIn('admin@demo.local', DEMO_PASSWORD);
  const me = await api(demoAdminToken, null, 'GET', '/auth/me');
  if (me.status !== 200) throw new Error(`/auth/me failed for demo admin: ${me.status}. Run provision:demo.`);
  const demo = me.body.tenants.find((t) => t.tenantName === 'Demo Hospital') ?? me.body.tenants[0];
  if (!demo) throw new Error('Demo Hospital membership missing. Run pnpm --filter @hms/api provision:demo.');

  // 4. Ensure E2E Clinic B exists (real platform API; idempotent by slug).
  const tenants = await api(saToken, null, 'GET', '/platform/tenants');
  if (tenants.status !== 200) throw new Error(`GET /platform/tenants failed: ${tenants.status}`);
  let clinicB = tenants.body.find((t) => t.slug === CLINIC_B.slug);
  let clinicBCreated = false;
  if (!clinicB) {
    const created = await api(saToken, null, 'POST', '/platform/tenants', {
      name: CLINIC_B.name,
      slug: CLINIC_B.slug,
      planCode: CLINIC_B.planCode,
      contactEmail: CLINIC_B.adminEmail,
    });
    if (created.status >= 300) throw new Error(`Create Clinic B failed: ${created.status} ${JSON.stringify(created.body)}`);
    clinicB = created.body;
    clinicBCreated = true;
    const invited = await api(saToken, null, 'POST', `/platform/tenants/${clinicB.id}/invite-admin`, {
      email: CLINIC_B.adminEmail,
      fullName: CLINIC_B.adminName,
      password: CLINIC_B.adminPassword,
    });
    if (invited.status >= 300) throw new Error(`Invite Clinic B admin failed: ${invited.status} ${JSON.stringify(invited.body)}`);
  }

  // 5. Self-heal module drift: the isolation/entitlement suites assume Clinic B
  //    is a plain GROWTH tenant. Manual platform toggles (or an aborted toggle
  //    test) can leave extra modules enabled — reset them every run.
  const GROWTH_MODULES = new Set(['ADMIN', 'PATIENT', 'OPD', 'SCHEDULING', 'BILLING', 'LAB', 'PHARMACY']);
  const mods = await api(saToken, null, 'GET', `/platform/tenants/${clinicB.id}/modules`);
  if (mods.status === 200 && Array.isArray(mods.body)) {
    for (const m of mods.body) {
      const shouldBeEnabled = GROWTH_MODULES.has(m.moduleCode);
      if (m.enabled !== shouldBeEnabled) {
        const res = await api(saToken, null, 'POST', `/platform/tenants/${clinicB.id}/modules`, {
          moduleCode: m.moduleCode,
          enabled: shouldBeEnabled,
        });
        if (res.status >= 300) throw new Error(`Failed to reset module ${m.moduleCode}: ${res.status}`);
        // eslint-disable-next-line no-console
        console.log(`[e2e] reset Clinic B module ${m.moduleCode} -> ${shouldBeEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        apiUrl: API_URL,
        webUrl: WEB_URL,
        webUp,
        demoTenantId: demo.tenantId,
        clinicB: { tenantId: clinicB.id, ...CLINIC_B, created: clinicBCreated },
      },
      null,
      2,
    ),
  );
  // eslint-disable-next-line no-console
  console.log(`[e2e] demo=${demo.tenantId} clinicB=${clinicB.id}${clinicBCreated ? ' (created)' : ''} web=${webUp ? 'up' : 'DOWN'}`);
};
