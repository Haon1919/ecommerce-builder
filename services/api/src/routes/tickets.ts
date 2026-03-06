import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireSuperAdmin, requireAdminOrSuperAdmin } from '../middleware/auth';
import { requirePermission } from '../middleware/auth.permission';

const router = Router();

const ticketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  category: z.string().optional(),
});

// POST /stores/:storeId/tickets - admin creates ticket
router.post('/:storeId/tickets', requirePermission('tickets:write'), async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const count = await prisma.supportTicket.count({});
  const ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`;

  const ticket = await prisma.supportTicket.create({
    data: {
      ...parsed.data,
      storeId,
      ticketNumber,
    },
  });

  res.status(201).json(ticket);
});

// GET /stores/:storeId/tickets - list tickets for store admin
router.get('/:storeId/tickets', requirePermission('tickets:read'), async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;

  const tickets = await prisma.supportTicket.findMany({
    where: { storeId },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      comments: {
        where: { internal: false }, // store admin can't see internal comments
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true } } },
      },
    },
  });

  res.json(tickets);
});

// GET /tickets - super admin: all tickets (Kanban)
router.get('/', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { status, storeId } = req.query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (storeId) where.storeId = storeId;

  const tickets = await prisma.supportTicket.findMany({
    where: where as any,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: {
      store: { select: { name: true, slug: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true } } },
      },
    },
  });

  // Group by status for Kanban
  const kanban = {
    OPEN: tickets.filter((t: any) => t.status === 'OPEN'),
    IN_PROGRESS: tickets.filter((t: any) => t.status === 'IN_PROGRESS'),
    WAITING_FOR_INFO: tickets.filter((t: any) => t.status === 'WAITING_FOR_INFO'),
    RESOLVED: tickets.filter((t: any) => t.status === 'RESOLVED'),
    CLOSED: tickets.filter((t: any) => t.status === 'CLOSED'),
  };

  res.json({ tickets, kanban });
});

// PATCH /tickets/:ticketId/status - super admin moves ticket
router.patch('/:ticketId/status', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const ticketId = req.params.ticketId as string;
  const { status } = req.body as { status: string };

  const updates: Record<string, unknown> = { status };
  if (status === 'RESOLVED') updates.resolvedAt = new Date();

  const ticket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: updates,
  });

  res.json(ticket);
});

// POST /tickets/:ticketId/comments - add comment (admin or super admin)
router.post('/:ticketId/comments', requireAdminOrSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const ticketId = req.params.ticketId as string;
  const { body, internal } = req.body as { body: string; internal?: boolean };

  if (!body?.trim()) {
    res.status(400).json({ error: 'Comment body required' });
    return;
  }

  // Only super admin can post internal comments
  const isInternal = internal === true && req.user?.type === 'SUPER_ADMIN';

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      userId: req.user?.type === 'USER' ? req.user.sub : null,
      body: body.trim(),
      internal: isInternal,
    },
    include: { user: { select: { name: true } } },
  });

  res.status(201).json(comment);
});

export default router;
