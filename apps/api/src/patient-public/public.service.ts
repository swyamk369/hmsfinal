import { Injectable, NotFoundException } from '@nestjs/common';
import { platformDb } from '@hms/db';

/**
 * Phase 22.3 — PUBLIC directory service. No tenant context, no auth. Reads ONLY
 * published, public-safe data across all tenants via the owner client and filters
 * to `isPublic` + `PUBLISHED`. Public search hits `PublicSearchIndex`; profiles come
 * from the published profile tables. Never exposes patient/staff/financial data.
 */
@Injectable()
export class PublicService {
  private hospitalView(hp: any) {
    return {
      tenantId: hp.tenantId, // needed by the booking layer to target the hospital
      slug: hp.hospitalSlug,
      name: hp.hospitalDisplayName,
      logoUrl: hp.logoUrl,
      coverImageUrl: hp.coverImageUrl,
      description: hp.description,
      address: hp.address,
      city: hp.city,
      state: hp.state,
      country: hp.country,
      phone: hp.phone,
      email: hp.email,
      website: hp.website,
      openingHours: hp.openingHours,
      facilities: hp.facilities,
      specialties: hp.specialties,
      services: hp.services,
      consultationTypes: hp.consultationTypes,
      insuranceAccepted: hp.insuranceAccepted,
      languages: hp.languages,
      bookingEnabled: hp.bookingEnabled,
    };
  }

  private doctorView(dp: any) {
    return {
      tenantId: dp.tenantId,
      doctorId: dp.doctorId,
      slug: dp.doctorSlug,
      name: dp.displayName,
      photoUrl: dp.photoUrl,
      specialty: dp.specialty,
      subSpecialties: dp.subSpecialties,
      qualifications: dp.qualifications,
      registrationNumber: dp.registrationNumber,
      bio: dp.bio,
      languages: dp.languages,
      gender: dp.gender,
      services: dp.services,
      consultationTypes: dp.consultationTypes,
      fees: dp.fees,
      acceptsNewPatients: dp.acceptsNewPatients,
      acceptsExistingPatients: dp.acceptsExistingPatients,
      telehealthAvailable: dp.telehealthAvailable,
      bookingEnabled: dp.bookingEnabled,
    };
  }

  private typeView(t: any) {
    return { id: t.id, name: t.name, description: t.description, durationMinutes: t.durationMinutes, price: t.price, currency: t.currency, consultationType: t.consultationType };
  }

  // ── Search (unified) ──────────────────────────────────────────
  async search(params: { q?: string; type?: string; city?: string; specialty?: string }) {
    const where: any = {};
    if (params.type && ['HOSPITAL', 'DOCTOR', 'SERVICE'].includes(params.type)) where.type = params.type;
    if (params.city) where.city = { equals: params.city, mode: 'insensitive' };
    if (params.specialty) where.specialty = { contains: params.specialty, mode: 'insensitive' };
    if (params.q) where.searchKeywords = { contains: params.q.toLowerCase() };
    return platformDb.publicSearchIndex.findMany({ where, orderBy: [{ type: 'asc' }, { hospitalName: 'asc' }], take: 100 });
  }

  async suggestions(q: string) {
    if (!q || q.length < 2) return [];
    const rows = await platformDb.publicSearchIndex.findMany({
      where: { searchKeywords: { contains: q.toLowerCase() } },
      select: { type: true, hospitalName: true, doctorName: true, specialty: true, profileUrl: true, photoUrl: true, logoUrl: true },
      take: 8,
    });
    return rows.map((r) => ({ type: r.type, label: r.doctorName ?? r.hospitalName, sub: r.specialty ?? r.hospitalName, href: r.profileUrl, photoUrl: r.photoUrl, logoUrl: r.logoUrl }));
  }

  // ── Hospitals ─────────────────────────────────────────────────
  hospitals(params: { q?: string; city?: string }) {
    const where: any = { type: 'HOSPITAL' };
    if (params.city) where.city = { equals: params.city, mode: 'insensitive' };
    if (params.q) where.searchKeywords = { contains: params.q.toLowerCase() };
    return platformDb.publicSearchIndex.findMany({ where, orderBy: { hospitalName: 'asc' }, take: 100 });
  }

  async hospitalBySlug(slug: string) {
    const hp = await platformDb.publicHospitalProfile.findFirst({ where: { hospitalSlug: slug, isPublic: true, profileStatus: 'PUBLISHED' as any } });
    if (!hp) throw new NotFoundException('Hospital not found or not published');
    const [doctors, types] = await Promise.all([
      platformDb.publicDoctorProfile.findMany({ where: { tenantId: hp.tenantId, isPublic: true, profileStatus: 'PUBLISHED' as any }, orderBy: { displayName: 'asc' } }),
      platformDb.appointmentType.findMany({ where: { tenantId: hp.tenantId, isPublic: true, isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    return { hospital: this.hospitalView(hp), doctors: doctors.map((d) => this.doctorView(d)), appointmentTypes: types.map((t) => this.typeView(t)) };
  }

  // ── Doctors ───────────────────────────────────────────────────
  doctors(params: { q?: string; specialty?: string; city?: string }) {
    const where: any = { type: 'DOCTOR' };
    if (params.city) where.city = { equals: params.city, mode: 'insensitive' };
    if (params.specialty) where.specialty = { contains: params.specialty, mode: 'insensitive' };
    if (params.q) where.searchKeywords = { contains: params.q.toLowerCase() };
    return platformDb.publicSearchIndex.findMany({ where, orderBy: { doctorName: 'asc' }, take: 100 });
  }

  async doctorBySlug(slug: string) {
    const dp = await platformDb.publicDoctorProfile.findFirst({ where: { doctorSlug: slug, isPublic: true, profileStatus: 'PUBLISHED' as any } });
    if (!dp) throw new NotFoundException('Doctor not found or not published');
    const [hp, types] = await Promise.all([
      platformDb.publicHospitalProfile.findFirst({ where: { tenantId: dp.tenantId, isPublic: true, profileStatus: 'PUBLISHED' as any } }),
      platformDb.appointmentType.findMany({ where: { tenantId: dp.tenantId, isPublic: true, isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    return { doctor: this.doctorView(dp), hospital: hp ? this.hospitalView(hp) : null, appointmentTypes: types.map((t) => this.typeView(t)) };
  }
}
