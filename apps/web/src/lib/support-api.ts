import { apiGet, apiPost, apiPatch } from './api';

export interface SupportTicket {
  id: string;
  tenantId: string | null;
  reporterId: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  comments: SupportTicketComment[];
}

export interface SupportTicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorType: 'STAFF' | 'PATIENT';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const supportApi = {
  listTickets: (tenantId?: string | null) => apiGet<SupportTicket[]>('/support/tickets', tenantId),
  getTicket: (id: string, tenantId?: string | null) => apiGet<SupportTicket>(`/support/tickets/${id}`, tenantId),
  createTicket: (
    data: { subject: string; description: string; priority?: string; category?: string },
    tenantId?: string | null,
  ) =>
    apiPost<SupportTicket>(
      '/support/tickets',
      {
        title: data.subject,
        description: data.description,
        priority: data.priority,
      },
      tenantId,
    ),
  updateStatus: (id: string, status: string, tenantId?: string | null) =>
    apiPatch<SupportTicket>(`/support/tickets/${id}/status`, { status }, tenantId),
  addComment: (id: string, content: string, tenantId?: string | null) =>
    apiPost<SupportTicketComment>(`/support/tickets/${id}/comments`, { content }, tenantId),
};
