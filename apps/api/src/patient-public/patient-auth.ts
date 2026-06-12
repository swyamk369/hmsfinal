import { platformDb } from '@hms/db';

export interface VerifiedPatientIdentity {
  uid: string;
  email?: string | null;
}

async function emailAvailableForUid(email: string, uid: string): Promise<boolean> {
  const owner = await platformDb.patientAuthUser.findUnique({ where: { email } });
  return !owner || owner.uid === uid;
}

export async function registerPatientAuthUser(identity: VerifiedPatientIdentity) {
  const email = identity.email ?? null;
  const now = new Date();
  const existing = await platformDb.patientAuthUser.findUnique({ where: { uid: identity.uid } });

  if (existing) {
    const canStoreEmail = email ? await emailAvailableForUid(email, identity.uid) : false;
    return platformDb.patientAuthUser.update({
      where: { uid: identity.uid },
      data: {
        lastLoginAt: now,
        ...(canStoreEmail ? { email } : {}),
      },
    });
  }

  const canStoreEmail = email ? await emailAvailableForUid(email, identity.uid) : false;
  try {
    return await platformDb.patientAuthUser.create({
      data: {
        uid: identity.uid,
        email: canStoreEmail ? email : null,
        status: 'ACTIVE',
        lastLoginAt: now,
      },
    });
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;

    return platformDb.patientAuthUser.create({
      data: {
        uid: identity.uid,
        email: null,
        status: 'ACTIVE',
        lastLoginAt: now,
      },
    });
  }
}
