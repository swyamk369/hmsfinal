import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getFirebaseApp, firebaseConfigured } from './firebase-credentials';

/**
 * Wraps firebase-admin. Firebase is the ONLY authentication mechanism — there is
 * no dev/header fallback. Credentials come from a service-account JSON file or
 * the FIREBASE_* env (see firebase-credentials.ts) and are validated at startup.
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  get configured(): boolean {
    return firebaseConfigured();
  }

  async verifyIdToken(token: string): Promise<{ uid: string; email?: string } | null> {
    try {
      const decoded = await admin.auth(getFirebaseApp()).verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email };
    } catch (e) {
      this.logger.warn(`Token verification failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** Create (or fetch) a Firebase auth user for invite / bootstrap flows. */
  async createUser(email: string, password: string, displayName?: string): Promise<string> {
    const auth = admin.auth(getFirebaseApp());
    try {
      const existing = await auth.getUserByEmail(email);
      return existing.uid;
    } catch {
      const user = await auth.createUser({ email, password, displayName });
      return user.uid;
    }
  }

  /**
   * Ensures a Firebase auth user exists for a staff invite. New users get a strong
   * random password they never see — they set their own via the password-reset
   * flow. Returns the uid and whether it was just created.
   */
  async ensureUser(email: string, displayName?: string): Promise<{ uid: string; created: boolean }> {
    const auth = admin.auth(getFirebaseApp());
    try {
      const existing = await auth.getUserByEmail(email);
      return { uid: existing.uid, created: false };
    } catch {
      const tempPassword = `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
      const user = await auth.createUser({ email, password: tempPassword, displayName });
      return { uid: user.uid, created: true };
    }
  }

  /** Generates a Firebase password-reset link (server-side reset flow). */
  async passwordResetLink(email: string): Promise<string> {
    return admin.auth(getFirebaseApp()).generatePasswordResetLink(email);
  }
}
