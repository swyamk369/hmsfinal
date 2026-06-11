import '../load-env';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { platformDb, PLAN_CODES, ROLES } from '@hms/db';
import { firebaseConfigured, getFirebaseApp } from '../common/firebase-credentials';
import { createTenant, provisionUser } from '../platform/provisioning';

/**
 * DEV ONLY — not part of the production seed. Provisions a demo hospital on the
 * ENTERPRISE plan (every module enabled, so every role's dashboard is reachable)
 * with one REAL Firebase user per tenant role. Idempotent. Shared password.
 *
 *   pnpm --filter @hms/api provision:demo
 */
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo-2026!';

async function dept(tenantId: string, name: string) {
  const found = await platformDb.department.findFirst({ where: { tenantId, name } });
  return found ?? platformDb.department.create({ data: { tenantId, name, type: 'CLINICAL' } });
}

// Lab test catalog + matching LAB service-catalog rows (so ordering a test can
// append a priced line item to an open encounter bill). Idempotent.
const LAB_TESTS = [
  { code: 'CBC', name: 'Complete Blood Count', specimenType: 'Blood (EDTA)', price: 30000 },
  { code: 'LIPID', name: 'Lipid Profile', specimenType: 'Serum', price: 60000 },
  { code: 'GLUC-F', name: 'Fasting Blood Glucose', specimenType: 'Plasma (Fluoride)', price: 15000 },
  { code: 'LFT', name: 'Liver Function Test', specimenType: 'Serum', price: 75000 },
  { code: 'TSH', name: 'Thyroid Stimulating Hormone', specimenType: 'Serum', price: 45000 },
];

async function seedLabCatalog(tenantId: string) {
  for (const t of LAB_TESTS) {
    const existing = await platformDb.labTestCatalog.findFirst({ where: { tenantId, code: t.code } });
    if (!existing) {
      await platformDb.labTestCatalog.create({
        data: { tenantId, code: t.code, name: t.name, specimenType: t.specimenType, price: t.price },
      });
    }
    const svc = await platformDb.serviceCatalog.findFirst({ where: { tenantId, code: `LAB-${t.code}` } });
    if (!svc) {
      await platformDb.serviceCatalog.create({
        data: { tenantId, code: `LAB-${t.code}`, name: t.name, type: 'LAB', price: t.price },
      });
    }
  }
  console.log(`  ✓ ${LAB_TESTS.length} lab tests + matching LAB service items`);
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'profile';

const LANGS = ['English', 'Hindi'];
const CTYPES = ['IN_PERSON', 'TELEHEALTH'];

/** Phase 22 — seed a published public profile + doctors + types + availability + search index. */
async function seedPublicLayer(
  tenantId: string,
  opts: { displayName: string; slug: string; city: string; state: string; specialties: string[]; services: string[]; doctors: { doctorId: string; name: string; specialty: string }[] },
) {
  await platformDb.patientPortalSettings.upsert({
    where: { tenantId },
    create: { tenantId, enabled: true, onlineBookingEnabled: true, bookingApprovalMode: 'AUTOMATIC', clinicDisplayName: opts.displayName, allowNewPatientBookings: true, allowExistingPatientBookings: true },
    update: { enabled: true, onlineBookingEnabled: true, bookingApprovalMode: 'AUTOMATIC' },
  });

  const hslug = `${opts.slug}-${tenantId.slice(0, 8)}`;
  await platformDb.publicHospitalProfile.upsert({
    where: { tenantId },
    create: {
      tenantId, hospitalSlug: hslug, hospitalDisplayName: opts.displayName, isPublic: true, bookingEnabled: true, profileStatus: 'PUBLISHED',
      description: `${opts.displayName} provides quality, patient-first care.`, city: opts.city, state: opts.state, country: 'India',
      phone: '+91 1800-000-000', specialties: opts.specialties, services: opts.services, consultationTypes: CTYPES, languages: LANGS, facilities: ['Pharmacy', 'Laboratory', 'Parking'],
    },
    update: { isPublic: true, bookingEnabled: true, profileStatus: 'PUBLISHED', specialties: opts.specialties, services: opts.services },
  });

  for (const t of [
    { name: 'GP Consultation', price: 50000, consultationType: 'IN_PERSON', durationMinutes: 15 },
    { name: 'Specialist Consultation', price: 100000, consultationType: 'IN_PERSON', durationMinutes: 20 },
    { name: 'Telehealth Consultation', price: 40000, consultationType: 'TELEHEALTH', durationMinutes: 15 },
  ]) {
    const ex = await platformDb.appointmentType.findFirst({ where: { tenantId, name: t.name } });
    if (!ex) await platformDb.appointmentType.create({ data: { tenantId, ...(t as any), isPublic: true, isActive: true } });
  }

  await platformDb.publicSearchIndex.deleteMany({ where: { type: 'HOSPITAL', tenantId } });
  await platformDb.publicSearchIndex.create({
    data: {
      type: 'HOSPITAL', tenantId, hospitalSlug: hslug, hospitalName: opts.displayName, services: opts.services, location: `${opts.city}, ${opts.state}`,
      city: opts.city, state: opts.state, country: 'India', consultationTypes: CTYPES, languages: LANGS, isBookable: true, profileUrl: `/hospitals/${hslug}`,
      searchKeywords: [opts.displayName, opts.city, opts.state, ...opts.specialties, ...opts.services].join(' ').toLowerCase(),
    },
  });

  for (const doc of opts.doctors) {
    const dslug = `${slugify(doc.name)}-${doc.doctorId.slice(0, 6)}`;
    const exists = await platformDb.publicDoctorProfile.findFirst({ where: { tenantId, doctorId: doc.doctorId } });
    if (!exists) {
      await platformDb.publicDoctorProfile.create({
        data: {
          tenantId, doctorId: doc.doctorId, doctorSlug: dslug, displayName: doc.name, specialty: doc.specialty, isPublic: true, bookingEnabled: true, profileStatus: 'PUBLISHED',
          qualifications: 'MBBS, MD', bio: `${doc.name} is an experienced ${doc.specialty} at ${opts.displayName}.`, languages: LANGS, services: opts.services, consultationTypes: CTYPES,
          acceptsNewPatients: true, acceptsExistingPatients: true, telehealthAvailable: true,
        },
      });
    }
    for (let day = 1; day <= 5; day++) {
      const ar = await platformDb.availabilityRule.findFirst({ where: { tenantId, doctorId: doc.doctorId, dayOfWeek: day } });
      if (!ar) await platformDb.availabilityRule.create({ data: { tenantId, doctorId: doc.doctorId, dayOfWeek: day, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 15, consultationTypes: CTYPES, isActive: true } });
    }
    await platformDb.publicSearchIndex.deleteMany({ where: { type: 'DOCTOR', tenantId, doctorId: doc.doctorId } });
    await platformDb.publicSearchIndex.create({
      data: {
        type: 'DOCTOR', tenantId, doctorId: doc.doctorId, doctorSlug: dslug, hospitalName: opts.displayName, doctorName: doc.name, specialty: doc.specialty, services: opts.services,
        consultationTypes: CTYPES, languages: LANGS, isBookable: true, profileUrl: `/doctors/${dslug}`, searchKeywords: [doc.name, doc.specialty, opts.displayName, opts.city].join(' ').toLowerCase(),
      },
    });
  }
  console.log(`  ✓ public layer: ${opts.displayName} (${opts.doctors.length} doctors) published & indexed`);
}

/** Phase 22.5 — a portal-linked demo patient (Firebase + PatientAuthUser + Patient + ACTIVE access + content). */
async function seedPortalPatient(tenantId: string, doctorId?: string) {
  const email = 'patient@demo.local';
  const auth = admin.auth(getFirebaseApp());
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email, password: PASSWORD, displayName: 'Priya Patient' })).uid;
  }
  await platformDb.patientAuthUser.upsert({
    where: { uid },
    create: { uid, email, displayName: 'Priya Patient', mobile: '+919812345678', status: 'ACTIVE' },
    update: { displayName: 'Priya Patient' },
  });

  let patient = await platformDb.patient.findFirst({ where: { tenantId, email } });
  if (!patient) {
    const n = await platformDb.patient.count({ where: { tenantId } });
    patient = await platformDb.patient.create({
      data: { tenantId, mrn: `DEM-2026-${String(n + 1).padStart(5, '0')}`, fullName: 'Priya Patient', dob: new Date('1990-05-15'), sex: 'FEMALE', phone: '+919812345678', email, address: 'Pune, Maharashtra', linkedPortalUid: uid },
    });
  } else if (!patient.linkedPortalUid) {
    await platformDb.patient.update({ where: { id: patient.id }, data: { linkedPortalUid: uid } });
  }

  const access = await platformDb.patientPortalAccess.findFirst({ where: { tenantId, uid, patientId: patient.id } });
  if (!access) {
    await platformDb.patientPortalAccess.create({
      data: { tenantId, uid, patientId: patient.id, hospitalDisplayName: 'Demo Hospital', email, accessStatus: 'ACTIVE', verificationStatus: 'VERIFIED', linkedAt: new Date() },
    });
  }

  if (!(await platformDb.patientDocument.findFirst({ where: { tenantId, patientId: patient.id, title: 'Welcome to Demo Hospital' } }))) {
    await platformDb.patientDocument.create({
      data: { tenantId, patientId: patient.id, title: 'Welcome to Demo Hospital', category: 'OTHER', source: 'GENERATED', documentUrl: 'https://example.com/welcome.pdf', fileName: 'welcome.pdf', mimeType: 'application/pdf', visibleToPatient: true, publishedAt: new Date() },
    });
  }
  if (!(await platformDb.bill.findFirst({ where: { tenantId, patientId: patient.id } }))) {
    const bn = `INV-2026-${String((await platformDb.bill.count({ where: { tenantId } })) + 1).padStart(5, '0')}`;
    await platformDb.bill.create({ data: { tenantId, patientId: patient.id, billNumber: bn, totalAmount: 50000, discount: 0, netAmount: 50000, status: 'UNPAID', notes: 'Consultation' } });
  }
  if (doctorId && !(await platformDb.appointment.findFirst({ where: { tenantId, patientId: patient.id } }))) {
    const when = new Date();
    when.setDate(when.getDate() + 2);
    when.setHours(10, 0, 0, 0);
    await platformDb.appointment.create({ data: { tenantId, patientId: patient.id, providerId: doctorId, scheduledAt: when, status: 'SCHEDULED', reason: 'Follow-up', source: 'ADMIN', consultationType: 'IN_PERSON' } });
  }
  console.log(`  ✓ portal patient: ${email} (pwd ${PASSWORD}) linked to Demo Hospital with a bill, document & appointment`);
}

async function main(): Promise<void> {
  if (!firebaseConfigured()) {
    console.error('Firebase is not configured.');
    process.exit(1);
  }

  console.log('Provisioning demo hospital (ENTERPRISE)…');
  const { tenant, roleMap } = await createTenant({
    name: 'Demo Hospital',
    slug: 'demo-hospital',
    planCode: PLAN_CODES.ENTERPRISE,
    contactEmail: 'contact@demo.local',
  });

  const medicine = await dept(tenant.id, 'General Medicine');
  const nursing = await dept(tenant.id, 'Nursing');
  await seedLabCatalog(tenant.id);

  const users: Array<{
    role: string;
    email: string;
    name: string;
    providerType?: 'DOCTOR' | 'NURSE';
    departmentId?: string;
    speciality?: string;
  }> = [
    { role: ROLES.HOSPITAL_ADMIN, email: 'admin@demo.local', name: 'Aarti Admin' },
    { role: ROLES.HOSPITAL_MANAGER, email: 'manager@demo.local', name: 'Manish Manager' },
    { role: ROLES.RECEPTION, email: 'reception@demo.local', name: 'Riya Reception' },
    {
      role: ROLES.DOCTOR,
      email: 'doctor@demo.local',
      name: 'Dr. Dev Sharma',
      providerType: 'DOCTOR',
      departmentId: medicine.id,
      speciality: 'General Physician',
    },
    {
      role: ROLES.NURSE,
      email: 'nurse@demo.local',
      name: 'Nita Nurse',
      providerType: 'NURSE',
      departmentId: nursing.id,
    },
    { role: ROLES.LAB_TECH, email: 'labtech@demo.local', name: 'Lalit Lab' },
    { role: ROLES.PHARMACIST, email: 'pharmacist@demo.local', name: 'Priya Pharma' },
    { role: ROLES.INVENTORY_MGR, email: 'inventory@demo.local', name: 'Inder Inventory' },
    { role: ROLES.BILLING, email: 'billing@demo.local', name: 'Bina Billing' },
    { role: ROLES.ACCOUNTANT, email: 'accountant@demo.local', name: 'Anil Accountant' },
    { role: ROLES.INSURANCE_STAFF, email: 'insurance@demo.local', name: 'Isha Insurance' },
  ];

  for (const u of users) {
    await provisionUser({
      tenantId: tenant.id,
      email: u.email,
      password: PASSWORD,
      fullName: u.name,
      roleCode: u.role,
      roleId: roleMap.get(u.role),
      providerType: u.providerType,
      departmentId: u.departmentId,
      speciality: u.speciality,
    });
    console.log(`  ✓ ${u.role.padEnd(17)} ${u.email}`);
  }

  // ── Phase 22: public patient layer demo data ────────────────
  console.log('Seeding public patient layer…');
  const demoDoctors = await platformDb.provider.findMany({
    where: { tenantId: tenant.id, type: 'DOCTOR' },
    include: { user: { select: { fullName: true } } },
  });
  await seedPublicLayer(tenant.id, {
    displayName: 'Demo Hospital',
    slug: 'demo-hospital',
    city: 'Pune',
    state: 'Maharashtra',
    specialties: ['General Medicine', 'Cardiology', 'Pediatrics'],
    services: ['Consultation', 'Lab Tests', 'Pharmacy', 'Health Checkup'],
    doctors: demoDoctors.map((d) => ({ doctorId: d.id, name: d.user.fullName, specialty: d.speciality || 'General Physician' })),
  });
  await seedPortalPatient(tenant.id, demoDoctors[0]?.id);

  // A second public hospital (no staff users) so global search spans multiple tenants.
  const sunrise = await createTenant({ name: 'Sunrise Clinic', slug: 'sunrise-clinic', planCode: PLAN_CODES.GROWTH, contactEmail: 'hello@sunrise.local' });
  await seedPublicLayer(sunrise.tenant.id, {
    displayName: 'Sunrise Clinic',
    slug: 'sunrise-clinic',
    city: 'Mumbai',
    state: 'Maharashtra',
    specialties: ['Dermatology', 'ENT', 'Orthopedics'],
    services: ['Consultation', 'Telehealth', 'Minor Procedures'],
    doctors: [
      { doctorId: randomUUID(), name: 'Dr. Meera Iyer', specialty: 'Dermatologist' },
      { doctorId: randomUUID(), name: 'Dr. Rohan Patel', specialty: 'Orthopedic Surgeon' },
    ],
  });

  console.log(`\n✅ Demo hospital ready. ${users.length} users, password for all: ${PASSWORD}`);
  console.log('   Public directory: 2 hospitals (Demo Hospital, Sunrise Clinic) published for /hospitals & /doctors.');
  await platformDb.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
