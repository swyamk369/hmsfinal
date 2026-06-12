import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@hms/db';

/**
 * Phase 22.2 — keeps PublicSearchIndex in sync with published public profiles.
 * The index holds ONLY public-safe fields (no patient/staff/financial data) and is
 * what the public directory queries. Re-sync = delete the entity's rows, then insert
 * a fresh row only while the profile is public + PUBLISHED.
 */
@Injectable()
export class SearchIndexService {
  private kw(parts: (string | null | undefined)[]): string {
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  async syncHospital(db: TenantClient, tenantId: string, profile: any | null, portalBookable: boolean) {
    await db.publicSearchIndex.deleteMany({ where: { type: 'HOSPITAL' as any, tenantId } });
    if (!profile || !profile.isPublic || profile.profileStatus !== 'PUBLISHED') return;
    await db.publicSearchIndex.create({
      data: {
        type: 'HOSPITAL' as any,
        tenantId,
        hospitalSlug: profile.hospitalSlug,
        hospitalName: profile.hospitalDisplayName,
        services: profile.services ?? [],
        location: [profile.city, profile.state].filter(Boolean).join(', ') || null,
        city: profile.city ?? null,
        state: profile.state ?? null,
        country: profile.country ?? null,
        consultationTypes: profile.consultationTypes ?? [],
        languages: profile.languages ?? [],
        isBookable: Boolean(profile.bookingEnabled && portalBookable),
        profileUrl: `/hospitals/${profile.hospitalSlug}`,
        logoUrl: profile.logoUrl ?? null,
        searchKeywords: this.kw([profile.hospitalDisplayName, profile.city, profile.state, ...(profile.specialties ?? []), ...(profile.services ?? [])]),
      },
    });
  }

  async syncDoctor(db: TenantClient, tenantId: string, profile: any | null, hospitalName: string, hospitalLogoUrl: string | null, portalBookable: boolean) {
    await db.publicSearchIndex.deleteMany({ where: { type: 'DOCTOR' as any, tenantId, doctorId: profile?.doctorId } });
    if (!profile || !profile.isPublic || profile.profileStatus !== 'PUBLISHED') return;
    await db.publicSearchIndex.create({
      data: {
        type: 'DOCTOR' as any,
        tenantId,
        doctorId: profile.doctorId,
        doctorSlug: profile.doctorSlug,
        hospitalName: hospitalName || '—',
        doctorName: profile.displayName,
        specialty: profile.specialty ?? null,
        services: profile.services ?? [],
        consultationTypes: profile.consultationTypes ?? [],
        languages: profile.languages ?? [],
        isBookable: Boolean(profile.bookingEnabled && portalBookable),
        profileUrl: `/doctors/${profile.doctorSlug}`,
        photoUrl: profile.photoUrl ?? null,
        logoUrl: hospitalLogoUrl,
        searchKeywords: this.kw([profile.displayName, profile.specialty, hospitalName, ...(profile.services ?? []), ...(profile.languages ?? [])]),
      },
    });
  }
}
