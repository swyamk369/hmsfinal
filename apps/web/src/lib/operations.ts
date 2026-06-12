import { apiGet } from './api';

export type WorkPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface WorkItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  patientId?: string | null;
  patientName?: string | null;
  module: string;
  priority: WorkPriority;
  status: string;
  assignedRole?: string | null;
  assignedUser?: string | null;
  dueAt?: string | null;
  createdAt: string;
  actionHref: string;
  blocker?: string | null;
  help: string;
  metadata?: Record<string, unknown>;
}

export interface WorkQueueResponse {
  generatedAt: string;
  roles: string[];
  items: WorkItem[];
}

export interface WorkQueueSummary {
  generatedAt: string;
  total: number;
  blockers: number;
  byPriority: Record<string, number>;
  byModule: Record<string, number>;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  subtitle: string;
  entityId: string | null;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
}

export const operationsApi = {
  workQueue: (tenantId: string) => apiGet<WorkQueueResponse>('/operations/work-queue', tenantId),
  summary: (tenantId: string) => apiGet<WorkQueueSummary>('/operations/work-queue/summary', tenantId),
  blockers: (tenantId: string) => apiGet<WorkQueueResponse>('/operations/blockers', tenantId),
  recentActivity: (tenantId: string) =>
    apiGet<{ generatedAt: string; items: RecentActivityItem[] }>('/operations/recent-activity', tenantId),
};
