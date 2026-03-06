import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import ticketsRouter from './tickets';
import { prisma } from '../db';
import * as AuthMiddleware from '../middleware/auth';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));
jest.mock('../middleware/auth', () => ({
  requireStoreAdmin: jest.fn((req: any, res: any, next: any) => next()),
  requireSuperAdmin: jest.fn((req: any, res: any, next: any) => { req.user = { sub: 'sa-1', type: 'SUPER_ADMIN' }; next(); }),
  requireAdminOrSuperAdmin: jest.fn((req: any, res: any, next: any) => next()),
}));

jest.mock('../middleware/auth.permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => {
    req.user = req.user || { sub: 'admin-1', type: 'USER', storeId: 'cl-store-123' };
    next();
  }),
}));
jest.mock('../services/roles.service', () => ({
  hasPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../utils/logger');
jest.mock('../config', () => ({ config: { logging: { level: 'info' } } }));

// --- Test Setup ---
const app = express();
app.use(express.json());

const mockedAuth = AuthMiddleware as jest.Mocked<typeof AuthMiddleware>;
// Default mock for admin/superadmin
mockedAuth.requireAdminOrSuperAdmin.mockImplementation((req: any, res: any, next: any) => {
  req.user = { sub: 'user-1', type: 'USER' }; // Default to store user
  if (req.headers['authorization']?.includes('super')) {
    req.user = { sub: 'sa-1', type: 'SUPER_ADMIN' };
  }
  next();
});
mockedAuth.requireStoreAdmin.mockImplementation((req: any, res: any, next: any) => next());
mockedAuth.requireSuperAdmin.mockImplementation((req: any, res: any, next: any) => next());

app.use('/', ticketsRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Tickets Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'store-1';
  const ticketId = 'ticket-1';
  const sampleTicket = { id: ticketId, storeId, title: 'Test Ticket', status: 'OPEN' };

  // --- POST /:storeId/tickets ---
  describe('POST /:storeId/tickets', () => {
    it('should create a new ticket', async () => {
      mockedPrisma.supportTicket.count.mockResolvedValue(99);
      mockedPrisma.supportTicket.create.mockResolvedValue({ ...sampleTicket, ticketNumber: 'TKT-00100' } as any);

      const res = await request(app).post(`/${storeId}/tickets`).send({ title: 'Help', description: 'I need help' });

      expect(res.status).toBe(201);
      expect(res.body.ticketNumber).toBe('TKT-00100');
    });
  });

  // --- GET / (Super Admin) ---
  describe('GET / (Super Admin)', () => {
    it('should return all tickets grouped by status for kanban view', async () => {
      mockedPrisma.supportTicket.findMany.mockResolvedValue([sampleTicket] as any);
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.kanban.OPEN).toHaveLength(1);
      expect(res.body.kanban.OPEN[0].id).toBe(ticketId);
    });
  });

  // --- PATCH /:ticketId/status ---
  describe('PATCH /:ticketId/status', () => {
    it('should update a ticket status', async () => {
      mockedPrisma.supportTicket.update.mockResolvedValue({ ...sampleTicket, status: 'RESOLVED' } as any);
      const res = await request(app).patch(`/${ticketId}/status`).send({ status: 'RESOLVED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESOLVED');
      expect(mockedPrisma.supportTicket.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: 'RESOLVED', resolvedAt: expect.any(Date) },
      }));
    });
  });

  // --- POST /:ticketId/comments ---
  describe('POST /:ticketId/comments', () => {
    it('should allow a super admin to post an internal comment', async () => {
      mockedPrisma.ticketComment.create.mockResolvedValue({} as any);
      await request(app)
        .post(`/${ticketId}/comments`)
        .set('Authorization', 'Bearer super-token')
        .send({ body: 'Internal note', internal: true });

      expect(mockedPrisma.ticketComment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ internal: true, userId: null }),
      }));
    });

    it('should not allow a store admin to post an internal comment', async () => {
      mockedPrisma.ticketComment.create.mockResolvedValue({} as any);
      await request(app)
        .post(`/${ticketId}/comments`)
        .set('Authorization', 'Bearer store-admin-token')
        .send({ body: 'Attempting internal note', internal: true });

      expect(mockedPrisma.ticketComment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ internal: false, userId: 'user-1' }), // Note: internal is forced to false
      }));
    });
  });
});
