import { apiGet, apiPost, apiPatch } from './api';

export interface SupportTicket {
  id: string;
  tenantId: string;
  userId: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'BUG' | 'FEATURE_REQUEST' | 'BILLING' | 'ACCESS' | 'GENERAL';
  createdAt: string;
  updatedAt: string;
  comments: SupportTicketComment[];
}

export interface SupportTicketComment {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export const supportApi = {
  listTickets: () => apiGet<SupportTicket[]>('/support/tickets'),
  getTicket: (id: string) => apiGet<SupportTicket>(`/support/tickets/${id}`),
  createTicket: (data: {
    subject: string;
    description: string;
    priority?: string;
    category?: string;
  }) => apiPost<SupportTicket>('/support/tickets', { title: data.subject, ...data }),
  updateStatus: (id: string, status: string) =>
    apiPatch<SupportTicket>(`/support/tickets/${id}/status`, { status }),
  addComment: (id: string, content: string, isInternal: boolean = false) =>
    apiPost<SupportTicketComment>(`/support/tickets/${id}/comments`, { content, isInternal }),
};
