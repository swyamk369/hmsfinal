import { apiGet, apiPost } from './api';

export const NOTIFICATION_CATEGORIES = [
  'APPOINTMENT',
  'LAB',
  'BILLING',
  'PHARMACY',
  'INVENTORY',
  'INSURANCE',
  'IPD',
  'SYSTEM',
] as const;
export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;

export interface NotificationDeliveryAttempt {
  id: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  provider?: string | null;
  errorMessage?: string | null;
  attemptedAt: string;
}

export interface AppNotification {
  id: string;
  category: (typeof NOTIFICATION_CATEGORIES)[number];
  type: string;
  severity: (typeof NOTIFICATION_SEVERITIES)[number];
  title: string;
  message: string;
  actionUrl?: string | null;
  readAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  deliveryAttempts?: NotificationDeliveryAttempt[];
}

export interface NotificationPreference {
  id: string | null;
  category: (typeof NOTIFICATION_CATEGORIES)[number];
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

export const notificationsApi = {
  list: (t: string, params: Record<string, string> = {}) => apiGet<AppNotification[]>(`/notifications${qs(params)}`, t),
  unreadCount: (t: string) => apiGet<{ count: number }>('/notifications/unread-count', t),
  markRead: (t: string, id: string) => apiPost<AppNotification>(`/notifications/${id}/read`, {}, t),
  readAll: (t: string) => apiPost<{ updated: number }>('/notifications/read-all', {}, t),
  archive: (t: string, id: string) => apiPost<AppNotification>(`/notifications/${id}/archive`, {}, t),
  preferences: (t: string) => apiGet<NotificationPreference[]>('/notifications/preferences', t),
  updatePreferences: (t: string, preferences: NotificationPreference[]) =>
    apiPost<NotificationPreference[]>('/notifications/preferences', { preferences }, t),
};
