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

async function facility(tenantId: string, name: string, address: string, phone: string) {
  const found = await platformDb.facility.findFirst({ where: { tenantId, name } });
  return (
    found ??
    platformDb.facility.create({
      data: { tenantId, name, address, phone, active: true },
    })
  );
}

async function dept(tenantId: string, name: string, facilityId?: string, type = 'CLINICAL') {
  const found = await platformDb.department.findFirst({ where: { tenantId, name } });
  if (found) {
    if (facilityId && !found.facilityId) {
      return platformDb.department.update({ where: { id: found.id }, data: { facilityId, type } });
    }
    return found;
  }
  return platformDb.department.create({ data: { tenantId, name, facilityId, type } });
}

const daysFromNow = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
};

// Lab test catalog + matching LAB service-catalog rows (so ordering a test can
// append a priced line item to an open encounter bill). Idempotent.
const LAB_TESTS = [
  { code: 'CBC', name: 'Complete Blood Count', specimenType: 'Blood (EDTA)', price: 30000 },
  { code: 'LIPID', name: 'Lipid Profile', specimenType: 'Serum', price: 60000 },
  { code: 'GLUC-F', name: 'Fasting Blood Glucose', specimenType: 'Plasma (Fluoride)', price: 15000 },
  { code: 'LFT', name: 'Liver Function Test', specimenType: 'Serum', price: 75000 },
  { code: 'TSH', name: 'Thyroid Stimulating Hormone', specimenType: 'Serum', price: 45000 },
];

const SERVICE_ITEMS = [
  { code: 'CONSULT-GP', name: 'General physician consultation', type: 'CONSULTATION', price: 60000 },
  { code: 'CONSULT-SPECIALIST', name: 'Specialist consultation', type: 'CONSULTATION', price: 120000 },
  { code: 'CONSULT-TELE', name: 'Telehealth consultation', type: 'CONSULTATION', price: 50000 },
  { code: 'ECG-12', name: '12 lead ECG', type: 'PROCEDURE', price: 45000 },
  { code: 'XRAY-CHEST', name: 'Chest X-ray', type: 'PROCEDURE', price: 80000 },
  { code: 'ECHO', name: '2D Echocardiography', type: 'PROCEDURE', price: 250000 },
  { code: 'VACCINE-FLU', name: 'Influenza vaccination', type: 'PROCEDURE', price: 90000 },
  { code: 'DRESSING', name: 'Wound dressing', type: 'PROCEDURE', price: 35000 },
  { code: 'BED-GEN', name: 'General ward bed charge', type: 'BED', price: 250000 },
  { code: 'BED-PRIVATE', name: 'Private room bed charge', type: 'BED', price: 650000 },
  { code: 'BED-ICU', name: 'ICU bed charge', type: 'BED', price: 1500000 },
];

async function seedServiceCatalog(tenantId: string) {
  const seeded: Record<string, { id: string; price: number; name: string }> = {};
  for (const item of SERVICE_ITEMS) {
    let svc = await platformDb.serviceCatalog.findFirst({ where: { tenantId, code: item.code } });
    if (svc) {
      svc = await platformDb.serviceCatalog.update({
        where: { id: svc.id },
        data: { name: item.name, type: item.type, price: item.price, active: true },
      });
    } else {
      svc = await platformDb.serviceCatalog.create({ data: { tenantId, ...item, active: true } });
    }
    seeded[item.code] = { id: svc.id, price: svc.price, name: svc.name };
  }

  const gp = seeded['CONSULT-GP'];
  if (gp) {
    await platformDb.hospitalSettings.upsert({
      where: { tenantId },
      create: { tenantId, defaultConsultationCatalogId: gp.id, invoicePrefix: 'DHM', mrnPrefix: 'DHM' },
      update: { defaultConsultationCatalogId: gp.id, invoicePrefix: 'DHM', mrnPrefix: 'DHM' },
    });
  }

  console.log(`  ✓ ${SERVICE_ITEMS.length} service catalog items`);
  return seeded;
}

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

async function seedWardsAndBeds(tenantId: string, services: Record<string, { id: string; price: number; name: string }>) {
  const wards = [
    { name: 'General Ward A', type: 'GENERAL', dailyRate: services['BED-GEN']?.price ?? 250000, beds: 8 },
    { name: 'Private Rooms', type: 'PRIVATE', dailyRate: services['BED-PRIVATE']?.price ?? 650000, beds: 6 },
    { name: 'ICU', type: 'ICU', dailyRate: services['BED-ICU']?.price ?? 1500000, beds: 4 },
  ];

  for (const w of wards) {
    const ward =
      (await platformDb.ward.findFirst({ where: { tenantId, name: w.name } })) ??
      (await platformDb.ward.create({
        data: {
          tenantId,
          name: w.name,
          type: w.type as any,
          dailyRate: w.dailyRate,
          chargeCatalogId:
            w.type === 'ICU'
              ? services['BED-ICU']?.id
              : w.type === 'PRIVATE'
                ? services['BED-PRIVATE']?.id
                : services['BED-GEN']?.id,
        },
      }));

    for (let i = 1; i <= w.beds; i++) {
      const bedNumber = `${w.type.slice(0, 1)}-${String(i).padStart(2, '0')}`;
      if (!(await platformDb.bed.findFirst({ where: { tenantId, wardId: ward.id, bedNumber } }))) {
        await platformDb.bed.create({ data: { tenantId, wardId: ward.id, bedNumber, status: 'AVAILABLE' } });
      }
    }
  }
  console.log('  ✓ wards and beds: General, Private, ICU');
}

async function seedInventory(tenantId: string) {
  const supplier =
    (await platformDb.supplier.findFirst({ where: { tenantId, name: 'MedSupply India Pvt Ltd' } })) ??
    (await platformDb.supplier.create({
      data: {
        tenantId,
        name: 'MedSupply India Pvt Ltd',
        contact: '+91 98765 12000',
        address: 'Bhosari MIDC, Pune',
      },
    }));

  const stock = [
    { name: 'Paracetamol 500mg tablet', sku: 'MED-PARA-500', unit: 'tablet', quantity: 1200, cost: 120, sale: 250 },
    { name: 'Amlodipine 5mg tablet', sku: 'MED-AMLO-5', unit: 'tablet', quantity: 800, cost: 180, sale: 350 },
    { name: 'Metformin 500mg tablet', sku: 'MED-MET-500', unit: 'tablet', quantity: 900, cost: 160, sale: 320 },
    { name: 'Atorvastatin 20mg tablet', sku: 'MED-ATOR-20', unit: 'tablet', quantity: 650, cost: 260, sale: 520 },
    { name: 'Salbutamol inhaler', sku: 'MED-SALB-INH', unit: 'inhaler', quantity: 85, cost: 16000, sale: 23500 },
    { name: 'Sterile dressing kit', sku: 'CON-DRESS-KIT', unit: 'kit', quantity: 180, cost: 8500, sale: 13500 },
  ];

  const items: Record<string, { id: string; sale: number }> = {};
  for (const s of stock) {
    let item = await platformDb.inventoryItem.findFirst({ where: { tenantId, sku: s.sku } });
    if (!item) {
      item = await platformDb.inventoryItem.create({
        data: {
          tenantId,
          name: s.name,
          type: s.sku.startsWith('CON-') ? 'CONSUMABLE' : 'DRUG',
          sku: s.sku,
          unit: s.unit,
          lowStockThreshold: 50,
        },
      });
    }
    items[s.name] = { id: item.id, sale: s.sale };

    const batchNumber = `DEMO-${s.sku}-2026`;
    if (!(await platformDb.inventoryBatch.findFirst({ where: { tenantId, itemId: item.id, batchNumber } }))) {
      await platformDb.inventoryBatch.create({
        data: {
          tenantId,
          itemId: item.id,
          supplierId: supplier.id,
          batchNumber,
          expiryDate: new Date('2027-12-31'),
          quantity: s.quantity,
          unitCost: s.cost,
          salePrice: s.sale,
        },
      });
    }
  }

  console.log(`  ✓ pharmacy inventory: ${stock.length} stocked items`);
  return items;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'profile';

const LANGS = ['English', 'Hindi'];
const CTYPES = ['IN_PERSON', 'TELEHEALTH'];

/** Phase 22 — seed a published public profile + doctors + types + availability + search index. */
async function seedPublicLayer(
  tenantId: string,
  opts: {
    displayName: string;
    slug: string;
    city: string;
    state: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    description?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    insuranceAccepted?: string[];
    specialties: string[];
    services: string[];
    doctors: {
      doctorId: string;
      name: string;
      specialty: string;
      qualifications?: string;
      registrationNumber?: string;
      bio?: string;
      gender?: string;
      fee?: number;
      photoUrl?: string;
    }[];
  },
) {
  await platformDb.patientPortalSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      enabled: true,
      onlineBookingEnabled: true,
      bookingApprovalMode: 'AUTOMATIC',
      clinicDisplayName: opts.displayName,
      allowNewPatientBookings: true,
      allowExistingPatientBookings: true,
    },
    update: { enabled: true, onlineBookingEnabled: true, bookingApprovalMode: 'AUTOMATIC' },
  });

  const hslug = `${opts.slug}-${tenantId.slice(0, 8)}`;
  const hospitalProfileData = {
    isPublic: true,
    bookingEnabled: true,
    profileStatus: 'PUBLISHED' as const,
    hospitalDisplayName: opts.displayName,
    description: opts.description ?? `${opts.displayName} provides quality, patient-first care.`,
    logoUrl: opts.logoUrl ?? null,
    coverImageUrl: opts.coverImageUrl ?? null,
    address: opts.address ?? null,
    city: opts.city,
    state: opts.state,
    country: 'India',
    postcode: '411001',
    phone: opts.phone ?? '+91 1800-000-000',
    email: opts.email ?? 'care@demo.local',
    website: opts.website ?? 'https://healthconnect.example/demo-hospital',
    openingHours: {
      Mon: '08:00-20:00',
      Tue: '08:00-20:00',
      Wed: '08:00-20:00',
      Thu: '08:00-20:00',
      Fri: '08:00-20:00',
      Sat: '09:00-17:00',
      Sun: 'Emergency only',
    } as any,
    specialties: opts.specialties,
    services: opts.services,
    consultationTypes: CTYPES,
    insuranceAccepted: opts.insuranceAccepted ?? ['Care Health', 'Star Health', 'ICICI Lombard', 'Self pay'],
    languages: LANGS,
    facilities: ['24x7 Emergency', 'Pharmacy', 'Laboratory', 'Digital X-ray', 'ICU', 'Parking', 'Cashless insurance desk'],
  };
  await platformDb.publicHospitalProfile.upsert({
    where: { tenantId },
    create: {
      tenantId,
      hospitalSlug: hslug,
      ...hospitalProfileData,
    },
    update: hospitalProfileData,
  });

  const location =
    (await platformDb.hospitalLocation.findFirst({ where: { tenantId, name: `${opts.displayName} Main Campus` } })) ??
    (await platformDb.hospitalLocation.create({
      data: {
        tenantId,
        name: `${opts.displayName} Main Campus`,
        address: opts.address ?? null,
        city: opts.city,
        state: opts.state,
        country: 'India',
        postcode: '411001',
        phone: opts.phone ?? '+91 1800-000-000',
        openingHours: hospitalProfileData.openingHours,
      },
    }));

  for (const t of [
    { name: 'GP Consultation', price: 50000, consultationType: 'IN_PERSON', durationMinutes: 15 },
    { name: 'Specialist Consultation', price: 100000, consultationType: 'IN_PERSON', durationMinutes: 20 },
    { name: 'Telehealth Consultation', price: 40000, consultationType: 'TELEHEALTH', durationMinutes: 15 },
  ]) {
    const ex = await platformDb.appointmentType.findFirst({ where: { tenantId, name: t.name } });
    if (!ex)
      await platformDb.appointmentType.create({ data: { tenantId, ...(t as any), isPublic: true, isActive: true } });
  }

  await platformDb.publicSearchIndex.deleteMany({ where: { type: 'HOSPITAL', tenantId } });
  await platformDb.publicSearchIndex.create({
    data: {
      type: 'HOSPITAL',
      tenantId,
      hospitalSlug: hslug,
      hospitalName: opts.displayName,
      services: opts.services,
      location: `${opts.city}, ${opts.state}`,
      city: opts.city,
      state: opts.state,
      country: 'India',
      consultationTypes: CTYPES,
      languages: LANGS,
      isBookable: true,
      profileUrl: `/hospitals/${hslug}`,
      searchKeywords: [opts.displayName, opts.city, opts.state, ...opts.specialties, ...opts.services]
        .join(' ')
        .toLowerCase(),
    },
  });

  for (const doc of opts.doctors) {
    const dslug = `${slugify(doc.name)}-${doc.doctorId.slice(0, 6)}`;
    await platformDb.publicDoctorProfile.upsert({
      where: { tenantId_doctorId: { tenantId, doctorId: doc.doctorId } },
      create: {
        tenantId,
        doctorId: doc.doctorId,
        doctorSlug: dslug,
        displayName: doc.name,
        specialty: doc.specialty,
        isPublic: true,
        bookingEnabled: true,
        profileStatus: 'PUBLISHED',
        qualifications: doc.qualifications ?? 'MBBS, MD',
        registrationNumber: doc.registrationNumber,
        bio: doc.bio ?? `${doc.name} is an experienced ${doc.specialty} at ${opts.displayName}.`,
        gender: doc.gender,
        photoUrl: doc.photoUrl,
        languages: LANGS,
        services: opts.services,
        consultationTypes: CTYPES,
        locationIds: [location.id],
        fees: { inPerson: doc.fee ?? 80000, telehealth: 50000, currency: 'INR' } as any,
        acceptsNewPatients: true,
        acceptsExistingPatients: true,
        telehealthAvailable: true,
      },
      update: {
        displayName: doc.name,
        specialty: doc.specialty,
        isPublic: true,
        bookingEnabled: true,
        profileStatus: 'PUBLISHED',
        qualifications: doc.qualifications ?? 'MBBS, MD',
        registrationNumber: doc.registrationNumber,
        bio: doc.bio ?? `${doc.name} is an experienced ${doc.specialty} at ${opts.displayName}.`,
        gender: doc.gender,
        photoUrl: doc.photoUrl,
        languages: LANGS,
        services: opts.services,
        consultationTypes: CTYPES,
        locationIds: [location.id],
        fees: { inPerson: doc.fee ?? 80000, telehealth: 50000, currency: 'INR' } as any,
        acceptsNewPatients: true,
        acceptsExistingPatients: true,
        telehealthAvailable: true,
      },
    });
    for (let day = 1; day <= 5; day++) {
      const ar = await platformDb.availabilityRule.findFirst({
        where: { tenantId, doctorId: doc.doctorId, dayOfWeek: day },
      });
      if (!ar)
        await platformDb.availabilityRule.create({
          data: {
            tenantId,
            doctorId: doc.doctorId,
            locationId: location.id,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '17:00',
            slotDurationMinutes: 15,
            consultationTypes: CTYPES,
            appointmentTypeIds: [],
            isActive: true,
          },
        });
    }
    await platformDb.publicSearchIndex.deleteMany({ where: { type: 'DOCTOR', tenantId, doctorId: doc.doctorId } });
    await platformDb.publicSearchIndex.create({
      data: {
        type: 'DOCTOR',
        tenantId,
        doctorId: doc.doctorId,
        doctorSlug: dslug,
        hospitalName: opts.displayName,
        doctorName: doc.name,
        specialty: doc.specialty,
        services: opts.services,
        consultationTypes: CTYPES,
        languages: LANGS,
        fees: doc.fee ?? 80000,
        photoUrl: doc.photoUrl,
        nextAvailableSlot: daysFromNow(1, 10),
        isBookable: true,
        profileUrl: `/doctors/${dslug}`,
        searchKeywords: [doc.name, doc.specialty, opts.displayName, opts.city, ...opts.services].join(' ').toLowerCase(),
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
    await auth.updateUser(uid, { password: PASSWORD, displayName: 'Priya Patient' });
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
      data: {
        tenantId,
        mrn: `DEM-2026-${String(n + 1).padStart(5, '0')}`,
        fullName: 'Priya Patient',
        dob: new Date('1990-05-15'),
        sex: 'FEMALE',
        phone: '+919812345678',
        email,
        address: 'Pune, Maharashtra',
        linkedPortalUid: uid,
      },
    });
  } else if (!patient.linkedPortalUid) {
    await platformDb.patient.update({ where: { id: patient.id }, data: { linkedPortalUid: uid } });
  }

  const access = await platformDb.patientPortalAccess.findFirst({ where: { tenantId, uid, patientId: patient.id } });
  if (!access) {
    await platformDb.patientPortalAccess.create({
      data: {
        tenantId,
        uid,
        patientId: patient.id,
        hospitalDisplayName: 'Demo Hospital',
        email,
        accessStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        linkedAt: new Date(),
      },
    });
  }

  if (
    !(await platformDb.patientDocument.findFirst({
      where: { tenantId, patientId: patient.id, title: 'Welcome to Demo Hospital' },
    }))
  ) {
    await platformDb.patientDocument.create({
      data: {
        tenantId,
        patientId: patient.id,
        title: 'Welcome to Demo Hospital',
        category: 'OTHER',
        source: 'GENERATED',
        documentUrl: 'https://example.com/welcome.pdf',
        fileName: 'welcome.pdf',
        mimeType: 'application/pdf',
        visibleToPatient: true,
        publishedAt: new Date(),
      },
    });
  }
  if (!(await platformDb.bill.findFirst({ where: { tenantId, patientId: patient.id } }))) {
    const bn = `INV-2026-${String((await platformDb.bill.count({ where: { tenantId } })) + 1).padStart(5, '0')}`;
    await platformDb.bill.create({
      data: {
        tenantId,
        patientId: patient.id,
        billNumber: bn,
        totalAmount: 50000,
        discount: 0,
        netAmount: 50000,
        status: 'UNPAID',
        notes: 'Consultation',
      },
    });
  }
  if (doctorId && !(await platformDb.appointment.findFirst({ where: { tenantId, patientId: patient.id } }))) {
    const when = new Date();
    when.setDate(when.getDate() + 2);
    when.setHours(10, 0, 0, 0);
    await platformDb.appointment.create({
      data: {
        tenantId,
        patientId: patient.id,
        providerId: doctorId,
        scheduledAt: when,
        status: 'SCHEDULED',
        reason: 'Follow-up',
        source: 'ADMIN',
        consultationType: 'IN_PERSON',
      },
    });
  }
  // Phase 23 — Care Team, Family, Notifications, published lab report, refill request.
  if (doctorId) {
    const prof = await platformDb.publicDoctorProfile.findFirst({ where: { tenantId, doctorId } });
    if (prof && !(await platformDb.patientSavedProvider.findFirst({ where: { uid, tenantId, doctorId } }))) {
      await platformDb.patientSavedProvider.create({
        data: {
          uid,
          tenantId,
          doctorId,
          doctorSlug: prof.doctorSlug,
          doctorName: prof.displayName,
          specialty: prof.specialty ?? null,
          hospitalName: 'Demo Hospital',
        },
      });
    }
  }
  if (!(await platformDb.patientSavedHospital.findFirst({ where: { uid, tenantId } }))) {
    await platformDb.patientSavedHospital.create({
      data: { uid, tenantId, hospitalName: 'Demo Hospital', city: 'Pune' },
    });
  }
  if (!(await platformDb.patientFamilyMember.findFirst({ where: { uid, fullName: 'Aarav Patient' } }))) {
    await platformDb.patientFamilyMember.create({
      data: { uid, fullName: 'Aarav Patient', relationship: 'Child', dob: new Date('2016-08-20'), sex: 'MALE' },
    });
  }
  if ((await platformDb.patientNotification.count({ where: { uid } })) === 0) {
    await platformDb.patientNotification.createMany({
      data: [
        {
          uid,
          tenantId,
          category: 'BOOKING',
          title: 'Appointment confirmed',
          body: 'Your follow-up at Demo Hospital is confirmed.',
          actionUrl: '/patient/appointments',
        },
        {
          uid,
          tenantId,
          category: 'DOCUMENT',
          title: 'New document shared',
          body: 'Demo Hospital shared a document with you.',
          actionUrl: '/patient/documents',
        },
      ],
    });
  }

  // A published (COMPLETED + verified) lab report so the clinical-record screen has real data.
  if (!(await platformDb.labOrder.findFirst({ where: { tenantId, patientId: patient.id } }))) {
    const order = await platformDb.labOrder.create({
      data: { tenantId, patientId: patient.id, status: 'COMPLETED', notes: 'Routine panel' },
    });
    const item = await platformDb.labOrderItem.create({
      data: {
        tenantId,
        labOrderId: order.id,
        testId: randomUUID(),
        testName: 'Complete Blood Count',
        status: 'COMPLETED',
      },
    });
    await platformDb.labResult.createMany({
      data: [
        {
          tenantId,
          labOrderItemId: item.id,
          testName: 'Hemoglobin',
          value: '13.5',
          unit: 'g/dL',
          referenceRange: '12.0-15.5',
          abnormalFlag: 'NORMAL',
          isVerified: true,
          verifiedAt: new Date(),
        },
        {
          tenantId,
          labOrderItemId: item.id,
          testName: 'WBC',
          value: '11.8',
          unit: '10^3/uL',
          referenceRange: '4.0-11.0',
          abnormalFlag: 'HIGH',
          isVerified: true,
          verifiedAt: new Date(),
        },
      ],
    });
  }

  // A pending refill request so the staff queue + patient prescriptions screen are demoable.
  if (!(await platformDb.prescriptionRefillRequest.findFirst({ where: { tenantId, patientId: patient.id } }))) {
    await platformDb.prescriptionRefillRequest.create({
      data: {
        tenantId,
        patientId: patient.id,
        uid,
        status: 'REQUESTED',
        note: 'Please refill my blood-pressure medication.',
      },
    });
  }

  console.log(
    `  ✓ portal patient: ${email} (pwd ${PASSWORD}) — bill, document, appointment, saved doctor/hospital, family, notifications, lab report & refill`,
  );
}

async function seedDemoPatients(
  tenantId: string,
  doctors: Array<{
    id: string;
    userId: string;
    user: { fullName: string };
    departmentId: string | null;
    speciality: string | null;
  }>,
  services: Record<string, { id: string; price: number; name: string }>,
  inventory: Record<string, { id: string; sale: number }>,
) {
  const leadDoctor = doctors.find((d) => d.speciality === 'General Physician') ?? doctors[0];
  const cardio = doctors.find((d) => d.speciality === 'Cardiology') ?? leadDoctor;
  const peds = doctors.find((d) => d.speciality === 'Pediatrics') ?? leadDoctor;

  const patients = [
    {
      mrn: 'DHM-2026-00001',
      fullName: 'Priya Nair',
      dob: new Date('1990-05-15'),
      sex: 'FEMALE',
      phone: '+91 98123 45678',
      email: 'patient@demo.local',
      address: 'Koregaon Park, Pune',
      doctor: leadDoctor,
      reason: 'Follow-up for hypertension',
      chiefComplaint: 'BP review and medication refill',
      diagnosis: 'Essential hypertension',
      icdCode: 'I10',
      prescription: 'Amlodipine 5mg tablet',
      status: 'SCHEDULED',
      amount: services['CONSULT-GP']?.price ?? 60000,
      paid: false,
      day: 2,
    },
    {
      mrn: 'DHM-2026-00002',
      fullName: 'Rohan Mehta',
      dob: new Date('1982-11-04'),
      sex: 'MALE',
      phone: '+91 98234 56789',
      email: 'rohan.mehta@example.com',
      address: 'Aundh, Pune',
      doctor: cardio,
      reason: 'Chest discomfort',
      chiefComplaint: 'Intermittent chest tightness on exertion',
      diagnosis: 'Atypical chest pain, ECG advised',
      icdCode: 'R07.89',
      prescription: 'Atorvastatin 20mg tablet',
      status: 'COMPLETED',
      amount: (services['CONSULT-SPECIALIST']?.price ?? 120000) + (services['ECG-12']?.price ?? 45000),
      paid: true,
      day: -1,
    },
    {
      mrn: 'DHM-2026-00003',
      fullName: 'Anika Shah',
      dob: new Date('2018-02-23'),
      sex: 'FEMALE',
      phone: '+91 98345 67890',
      email: 'parent.anika@example.com',
      address: 'Baner, Pune',
      doctor: peds,
      reason: 'Fever and cough',
      chiefComplaint: 'Fever for two days with dry cough',
      diagnosis: 'Acute viral upper respiratory infection',
      icdCode: 'J06.9',
      prescription: 'Paracetamol 500mg tablet',
      status: 'CHECKED_IN',
      amount: services['CONSULT-SPECIALIST']?.price ?? 120000,
      paid: false,
      day: 0,
    },
  ];

  for (const p of patients) {
    let patient = await platformDb.patient.findFirst({ where: { tenantId, mrn: p.mrn } });
    if (!patient) {
      patient = await platformDb.patient.create({
        data: {
          tenantId,
          mrn: p.mrn,
          fullName: p.fullName,
          dob: p.dob,
          sex: p.sex as any,
          phone: p.phone,
          email: p.email,
          address: p.address,
          emergencyContactName: p.fullName === 'Anika Shah' ? 'Neha Shah' : 'Family contact',
          emergencyContactPhone: '+91 98989 00000',
        },
      });
    }

    const appointment =
      (await platformDb.appointment.findFirst({ where: { tenantId, patientId: patient.id, reason: p.reason } })) ??
      (await platformDb.appointment.create({
        data: {
          tenantId,
          patientId: patient.id,
          providerId: p.doctor?.id,
          departmentId: p.doctor?.departmentId ?? undefined,
          scheduledAt: daysFromNow(p.day, p.day < 0 ? 11 : 10),
          status: p.status as any,
          reason: p.reason,
          source: 'ADMIN',
          consultationType: 'IN_PERSON',
        },
      }));

    let encounter = await platformDb.encounter.findFirst({
      where: { tenantId, patientId: patient.id, chiefComplaint: p.chiefComplaint },
    });
    if (!encounter) {
      encounter = await platformDb.encounter.create({
        data: {
          tenantId,
          patientId: patient.id,
          providerId: p.doctor?.id,
          appointmentId: appointment.id,
          departmentId: p.doctor?.departmentId ?? undefined,
          status: p.status === 'COMPLETED' ? 'COMPLETED' : p.status === 'CHECKED_IN' ? 'CHECKED_IN' : 'SCHEDULED',
          chiefComplaint: p.chiefComplaint,
          tokenNumber: p.fullName === 'Anika Shah' ? 7 : undefined,
          startedAt: p.status === 'COMPLETED' ? daysFromNow(-1, 11) : undefined,
          endedAt: p.status === 'COMPLETED' ? daysFromNow(-1, 11, 25) : undefined,
          followUpDate: daysFromNow(14, 10),
          followUpNotes: 'Review symptoms and medication adherence.',
        },
      });

      await platformDb.vitals.create({
        data: {
          tenantId,
          encounterId: encounter.id,
          systolicBp: p.fullName === 'Priya Nair' ? 138 : 118,
          diastolicBp: p.fullName === 'Priya Nair' ? 86 : 76,
          pulse: p.fullName === 'Anika Shah' ? 104 : 78,
          temperature: p.fullName === 'Anika Shah' ? 38.2 : 36.8,
          spo2: 98,
          weightKg: p.fullName === 'Anika Shah' ? 22 : 68,
          heightCm: p.fullName === 'Anika Shah' ? 118 : 170,
          notes: 'Demo triage vitals',
        },
      });
      await platformDb.diagnosis.create({
        data: {
          tenantId,
          encounterId: encounter.id,
          icdCode: p.icdCode,
          description: p.diagnosis,
          type: p.status === 'COMPLETED' ? 'FINAL' : 'PROVISIONAL',
        },
      });
      await platformDb.clinicalNote.create({
        data: {
          tenantId,
          encounterId: encounter.id,
          authorId: p.doctor?.userId,
          noteType: 'SOAP',
          content:
            'Subjective, objective, assessment, and plan added for demo walkthrough. Patient understands follow-up instructions.',
        },
      });

      const rx = await platformDb.prescription.create({
        data: {
          tenantId,
          encounterId: encounter.id,
          providerId: p.doctor?.id,
          status: 'FINALIZED',
          notes: 'Demo prescription generated during visit.',
          finalizedAt: new Date(),
        },
      });
      await platformDb.prescriptionItem.create({
        data: {
          tenantId,
          prescriptionId: rx.id,
          inventoryItemId: inventory[p.prescription]?.id,
          drugName: p.prescription,
          dosage: p.prescription.includes('Paracetamol') ? '500mg' : '1 tablet',
          frequency: p.prescription.includes('Paracetamol') ? 'Every 8 hours as needed' : 'Once daily',
          duration: p.prescription.includes('Paracetamol') ? '3 days' : '30 days',
          route: 'Oral',
          instructions: 'Take after food.',
          quantity: p.prescription.includes('Paracetamol') ? 10 : 30,
        },
      });
    }

    if (!(await platformDb.labOrder.findFirst({ where: { tenantId, patientId: patient.id, encounterId: encounter.id } }))) {
      const order = await platformDb.labOrder.create({
        data: {
          tenantId,
          patientId: patient.id,
          encounterId: encounter.id,
          providerId: p.doctor?.id,
          status: p.status === 'COMPLETED' ? 'COMPLETED' : 'ORDERED',
          notes: p.fullName === 'Rohan Mehta' ? 'Cardiac baseline panel' : 'Routine baseline panel',
        },
      });
      const testName = p.fullName === 'Rohan Mehta' ? 'Lipid Profile' : 'Complete Blood Count';
      const item = await platformDb.labOrderItem.create({
        data: { tenantId, labOrderId: order.id, testId: randomUUID(), testName, status: order.status as any },
      });
      if (p.status === 'COMPLETED') {
        await platformDb.labResult.create({
          data: {
            tenantId,
            labOrderItemId: item.id,
            testName: 'LDL Cholesterol',
            value: '142',
            unit: 'mg/dL',
            referenceRange: '<100',
            abnormalFlag: 'HIGH',
            isVerified: true,
            verifiedAt: new Date(),
          },
        });
      }
    }

    const billNumber = `DHM-${p.mrn.slice(-5)}`;
    let bill = await platformDb.bill.findFirst({ where: { tenantId, billNumber } });
    if (!bill) {
      bill = await platformDb.bill.create({
        data: {
          tenantId,
          patientId: patient.id,
          encounterId: encounter.id,
          billNumber,
          totalAmount: p.amount,
          discount: 0,
          netAmount: p.amount,
          status: p.paid ? 'PAID' : 'UNPAID',
          notes: 'Demo visit bill',
        },
      });
      await platformDb.billItem.create({
        data: {
          tenantId,
          billId: bill.id,
          catalogId: services[p.doctor?.speciality === 'General Physician' ? 'CONSULT-GP' : 'CONSULT-SPECIALIST']?.id,
          sourceType: 'CONSULTATION',
          name: p.doctor?.speciality === 'General Physician' ? 'General consultation' : 'Specialist consultation',
          quantity: 1,
          unitPrice: p.doctor?.speciality === 'General Physician' ? 60000 : 120000,
          total: p.doctor?.speciality === 'General Physician' ? 60000 : 120000,
        },
      });
      if (p.fullName === 'Rohan Mehta') {
        await platformDb.billItem.create({
          data: {
            tenantId,
            billId: bill.id,
            catalogId: services['ECG-12']?.id,
            sourceType: 'PROCEDURE',
            name: '12 lead ECG',
            quantity: 1,
            unitPrice: 45000,
            total: 45000,
          },
        });
      }
      if (p.paid) {
        await platformDb.payment.create({
          data: {
            tenantId,
            billId: bill.id,
            amount: p.amount,
            method: 'UPI',
            transactionId: `DEMO-UPI-${p.mrn.slice(-5)}`,
            notes: 'Demo payment',
          },
        });
      }
    }
  }

  console.log(`  ✓ ${patients.length} realistic patient journeys with OPD, labs, prescriptions, and bills`);
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

  const mainCampus = await facility(
    tenant.id,
    'Demo Hospital Main Campus',
    '14 Wellness Avenue, Koregaon Park, Pune, Maharashtra',
    '+91 20 4123 4567',
  );
  const medicine = await dept(tenant.id, 'General Medicine', mainCampus.id);
  const cardiology = await dept(tenant.id, 'Cardiology', mainCampus.id);
  const pediatrics = await dept(tenant.id, 'Pediatrics', mainCampus.id);
  const orthopedics = await dept(tenant.id, 'Orthopedics', mainCampus.id);
  const nursing = await dept(tenant.id, 'Nursing', mainCampus.id, 'NURSING');
  const services = await seedServiceCatalog(tenant.id);
  await seedLabCatalog(tenant.id);
  await seedWardsAndBeds(tenant.id, services);
  const inventory = await seedInventory(tenant.id);

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
      role: ROLES.DOCTOR,
      email: 'cardiology@demo.local',
      name: 'Dr. Anaya Rao',
      providerType: 'DOCTOR',
      departmentId: cardiology.id,
      speciality: 'Cardiology',
    },
    {
      role: ROLES.DOCTOR,
      email: 'pediatrics@demo.local',
      name: 'Dr. Meera Iyer',
      providerType: 'DOCTOR',
      departmentId: pediatrics.id,
      speciality: 'Pediatrics',
    },
    {
      role: ROLES.DOCTOR,
      email: 'orthopedics@demo.local',
      name: 'Dr. Rohan Patel',
      providerType: 'DOCTOR',
      departmentId: orthopedics.id,
      speciality: 'Orthopedics',
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
  const auth = admin.auth(getFirebaseApp());

  for (const u of users) {
    const { uid } = await provisionUser({
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
    await auth.updateUser(uid, { password: PASSWORD, displayName: u.name });
    console.log(`  ✓ ${u.role.padEnd(17)} ${u.email}`);
  }

  const doctorMetadata: Record<
    string,
    { registrationNumber: string; qualifications: string; bio: string; gender: string; fee: number; photoUrl: string }
  > = {
    'doctor@demo.local': {
      registrationNumber: 'MMC-2011-48291',
      qualifications: 'MBBS, MD Family Medicine',
      bio: 'Focuses on preventive care, chronic disease follow-up, and coordinated family medicine.',
      gender: 'Male',
      fee: 60000,
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=640&q=80',
    },
    'cardiology@demo.local': {
      registrationNumber: 'MMC-2009-31740',
      qualifications: 'MBBS, MD Medicine, DM Cardiology',
      bio: 'Cardiologist specializing in preventive cardiology, hypertension, and post-discharge cardiac follow-up.',
      gender: 'Female',
      fee: 140000,
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=640&q=80',
    },
    'pediatrics@demo.local': {
      registrationNumber: 'MMC-2014-62831',
      qualifications: 'MBBS, DCH, MD Pediatrics',
      bio: 'Pediatrician focused on fever clinics, vaccinations, growth monitoring, and child wellness.',
      gender: 'Female',
      fee: 90000,
      photoUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=640&q=80',
    },
    'orthopedics@demo.local': {
      registrationNumber: 'MMC-2010-53882',
      qualifications: 'MBBS, MS Orthopedics',
      bio: 'Orthopedic surgeon for sports injuries, joint pain, fracture follow-ups, and rehabilitation planning.',
      gender: 'Male',
      fee: 120000,
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=640&q=80',
    },
  };

  for (const [email, meta] of Object.entries(doctorMetadata)) {
    const user = await platformDb.user.findUnique({ where: { email } });
    if (!user) continue;
    const provider = await platformDb.provider.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    if (provider) {
      await platformDb.provider.update({
        where: { id: provider.id },
        data: { registrationNumber: meta.registrationNumber, speciality: provider.speciality },
      });
    }
  }

  // ── Phase 22: public patient layer demo data ────────────────
  console.log('Seeding public patient layer…');
  const demoDoctors = await platformDb.provider.findMany({
    where: { tenantId: tenant.id, type: 'DOCTOR' },
    include: { user: { select: { fullName: true, email: true } } },
  });
  await seedPublicLayer(tenant.id, {
    displayName: 'Demo Hospital',
    slug: 'demo-hospital',
    city: 'Pune',
    state: 'Maharashtra',
    address: '14 Wellness Avenue, Koregaon Park, Pune, Maharashtra',
    phone: '+91 20 4123 4567',
    email: 'care@demohospital.local',
    website: 'https://healthconnect.example/demo-hospital',
    description:
      'A full-service multi-specialty demo hospital with connected OPD, diagnostics, pharmacy, IPD, billing, insurance, and patient portal workflows.',
    logoUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=240&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80',
    specialties: ['General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Diagnostics'],
    services: ['Consultation', 'Lab Tests', 'Pharmacy', 'Health Checkup', 'Emergency Care', 'Telehealth'],
    doctors: demoDoctors.map((d) => ({
      doctorId: d.id,
      name: d.user.fullName,
      specialty: d.speciality || 'General Physician',
      qualifications: doctorMetadata[d.user.email]?.qualifications,
      registrationNumber: doctorMetadata[d.user.email]?.registrationNumber,
      bio: doctorMetadata[d.user.email]?.bio,
      gender: doctorMetadata[d.user.email]?.gender,
      fee: doctorMetadata[d.user.email]?.fee,
      photoUrl: doctorMetadata[d.user.email]?.photoUrl,
    })),
  });
  await seedPortalPatient(tenant.id, demoDoctors[0]?.id);
  await seedDemoPatients(
    tenant.id,
    demoDoctors.map((d) => ({
      id: d.id,
      userId: d.userId,
      user: { fullName: d.user.fullName },
      departmentId: d.departmentId,
      speciality: d.speciality,
    })),
    services,
    inventory,
  );

  // A second public hospital (no staff users) so global search spans multiple tenants.
  const sunrise = await createTenant({
    name: 'Sunrise Clinic',
    slug: 'sunrise-clinic',
    planCode: PLAN_CODES.GROWTH,
    contactEmail: 'hello@sunrise.local',
  });
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
