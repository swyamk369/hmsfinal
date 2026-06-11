import { Injectable } from '@nestjs/common';
import { platformDb } from '@hms/db';

type Category = 'BOOKING' | 'DOCUMENT' | 'BILLING' | 'REFILL' | 'GENERAL';

interface NotifyInput {
  category: Category;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  tenantId?: string | null;
}

/**
 * Phase 23 — writes patient-facing notifications from REAL workflow events into the GLOBAL
 * PatientNotification table (keyed by Firebase uid). NOT the staff Notification model.
 * Respects the patient's per-category preferences; never fabricates notifications.
 */
@Injectable()
export class PatientNotifyService {
  /** Notify a single portal identity (uid), honoring their category preferences. */
  async notifyUid(uid: string, input: NotifyInput): Promise<void> {
    const pref = await platformDb.patientAuthUser.findUnique({
      where: { uid },
      select: { notifyBookingUpdates: true, notifyDocuments: true, notifyBilling: true },
    });
    if (!pref) return; // not a registered portal user — nothing to notify
    if (input.category === 'BOOKING' && !pref.notifyBookingUpdates) return;
    if (input.category === 'DOCUMENT' && !pref.notifyDocuments) return;
    if (input.category === 'BILLING' && !pref.notifyBilling) return;
    await platformDb.patientNotification.create({
      data: {
        uid,
        tenantId: input.tenantId ?? null,
        category: input.category,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
      },
    });
  }

  /**
   * Notify every portal identity with ACTIVE access to a hospital patient record
   * (e.g. when staff publish a document or update a bill for that patient).
   */
  async notifyPatientRecord(tenantId: string, patientId: string, input: NotifyInput): Promise<void> {
    const links = await platformDb.patientPortalAccess.findMany({
      where: { tenantId, patientId, accessStatus: 'ACTIVE' as any },
      select: { uid: true },
    });
    await Promise.all([...new Set(links.map((l) => l.uid))].map((uid) => this.notifyUid(uid, { ...input, tenantId })));
  }
}
