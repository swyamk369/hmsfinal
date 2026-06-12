import { NotFoundException } from '@nestjs/common';

jest.mock('@hms/db', () => {
  const actual = jest.requireActual('@hms/db');
  return {
    __esModule: true,
    ...actual,
    platformDb: {
      supportTicket: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      supportTicketComment: {
        create: jest.fn(),
      },
    },
  };
});

import { platformDb } from '@hms/db';
import { SupportService } from '../src/support/support.service';
import { emptyContext, type RequestContext } from '../src/common/types';

const db = platformDb as any;

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    ...emptyContext(),
    userId: 'user-1',
    tenantId: 'tenant-a',
    ...overrides,
  };
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    tenantId: 'tenant-b',
    reporterId: 'reporter-1',
    reporterType: 'STAFF',
    title: 'Login is broken',
    description: 'Manual ticket',
    status: 'OPEN',
    priority: 'HIGH',
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SupportService', () => {
  let svc: SupportService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SupportService();
  });

  it('shows the global support queue to platform super admins', async () => {
    db.supportTicket.findMany.mockResolvedValue([ticket()]);

    const out = await svc.listTickets(ctx({ isPlatform: true, tenantId: null }));

    expect(out).toHaveLength(1);
    expect(db.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    );
    expect(db.supportTicket.findMany.mock.calls[0][0]).not.toHaveProperty('where');
  });

  it('shows the global support queue to platform support staff', async () => {
    db.supportTicket.findMany.mockResolvedValue([ticket()]);

    await svc.listTickets(ctx({ isSupport: true, tenantId: null }));

    expect(db.supportTicket.findMany.mock.calls[0][0]).not.toHaveProperty('where');
  });

  it('keeps tenant users scoped to their tenant and own reported tickets', async () => {
    db.supportTicket.findMany.mockResolvedValue([]);

    await svc.listTickets(ctx({ userId: 'user-1', tenantId: 'tenant-a' }));

    expect(db.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ tenantId: 'tenant-a' }, { reporterId: 'user-1' }] },
      }),
    );
  });

  it('lets platform admins open and update tickets from any tenant', async () => {
    db.supportTicket.findUnique.mockResolvedValue(ticket());
    db.supportTicket.update.mockResolvedValue(ticket({ status: 'IN_PROGRESS' }));

    await expect(svc.getTicket(ctx({ isPlatform: true, tenantId: null }), 'ticket-1')).resolves.toMatchObject({
      id: 'ticket-1',
    });
    await svc.updateTicketStatus(ctx({ isPlatform: true, tenantId: null }), 'ticket-1', 'IN_PROGRESS' as any);

    expect(db.supportTicket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('lets platform support staff open and update tickets from any tenant', async () => {
    db.supportTicket.findUnique.mockResolvedValue(ticket());
    db.supportTicket.update.mockResolvedValue(ticket({ status: 'RESOLVED' }));

    await expect(svc.getTicket(ctx({ isSupport: true, tenantId: null }), 'ticket-1')).resolves.toMatchObject({
      id: 'ticket-1',
    });
    await svc.updateTicketStatus(ctx({ isSupport: true, tenantId: null }), 'ticket-1', 'RESOLVED' as any);

    expect(db.supportTicket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { status: 'RESOLVED' },
    });
  });

  it('does not let tenant users open or close tickets outside their scope', async () => {
    db.supportTicket.findUnique.mockResolvedValue(ticket({ tenantId: 'tenant-b', reporterId: 'someone-else' }));

    await expect(svc.getTicket(ctx({ userId: 'user-1', tenantId: 'tenant-a' }), 'ticket-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      svc.updateTicketStatus(ctx({ userId: 'user-1', tenantId: 'tenant-a' }), 'ticket-1', 'CLOSED' as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.supportTicket.update).not.toHaveBeenCalled();
  });
});
