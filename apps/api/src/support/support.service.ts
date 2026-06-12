import { Injectable, NotFoundException } from '@nestjs/common';
import { platformDb, TicketStatus, TicketPriority } from '@hms/db';
import type { RequestContext } from '../common/types';

export interface CreateTicketDto {
  title: string;
  description: string;
  priority?: TicketPriority;
}

export interface AddCommentDto {
  content: string;
}

@Injectable()
export class SupportService {
  private hasGlobalQueueAccess(ctx: RequestContext) {
    return ctx.isPlatform || ctx.isSupport;
  }

  async listTickets(ctx: RequestContext) {
    if (this.hasGlobalQueueAccess(ctx)) {
      // Platform admins and support staff see the global support queue.
      return platformDb.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    } else {
      // Normal users (Staff) only see tickets from their own tenant,
      // or if they reported it
      if (!ctx.tenantId) {
        return platformDb.supportTicket.findMany({
          where: { reporterId: ctx.userId! },
          orderBy: { createdAt: 'desc' },
        });
      }
      return platformDb.supportTicket.findMany({
        where: {
          OR: [{ tenantId: ctx.tenantId }, { reporterId: ctx.userId! }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }
  }

  async createTicket(ctx: RequestContext, dto: CreateTicketDto) {
    return platformDb.supportTicket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'LOW',
        tenantId: ctx.tenantId,
        reporterId: ctx.userId!,
        reporterType: 'STAFF', // Assuming staff is the one hitting this API endpoint usually
        status: 'OPEN',
      },
    });
  }

  async getTicket(ctx: RequestContext, id: string) {
    const ticket = await platformDb.supportTicket.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!this.hasGlobalQueueAccess(ctx) && ticket.tenantId !== ctx.tenantId && ticket.reporterId !== ctx.userId) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async updateTicketStatus(ctx: RequestContext, id: string, status: TicketStatus) {
    // Platform/support staff can triage globally; reporters can only close their own ticket.
    if (!this.hasGlobalQueueAccess(ctx) && status !== 'CLOSED') {
      throw new NotFoundException('Not authorized to update status');
    }

    await this.getTicket(ctx, id);

    return platformDb.supportTicket.update({
      where: { id },
      data: { status },
    });
  }

  async addComment(ctx: RequestContext, id: string, dto: AddCommentDto) {
    await this.getTicket(ctx, id); // Ensure they have access to it

    return platformDb.supportTicketComment.create({
      data: {
        ticketId: id,
        content: dto.content,
        authorId: ctx.userId!,
        authorType: 'STAFF',
      },
    });
  }
}
