import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import storeRouter from './stores';
import { prisma } from '../db';
import * as encryption from '../services/encryption';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../middleware/auth', () => ({
  requireStoreAdmin: (req: any, res: any, next: any) => next(),
  requireSuperAdmin: (req: any, res: any, next: any) => next(),
}));

jest.mock('../services/encryption', () => ({
  encrypt: jest.fn((text) => `encrypted-${text}`),
  decrypt: jest.fn(),
}));

// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/', storeRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedEncryption = encryption as jest.Mocked<typeof encryption>;

describe('Store Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'cl-store-123';
  const sampleStore = {
    id: storeId,
    name: 'Test Store',
    slug: 'test-store',
    active: true,
    settings: { contactEmail: 'test@store.com' },
  };

  // --- GET /:storeId ---
  describe('GET /:storeId', () => {
    it('should return a store if found and active', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(sampleStore as any);
      const res = await request(app).get(`/${storeId}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Store');
    });

    it('should return 404 if store is not found', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(null);
      const res = await request(app).get(`/${storeId}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 if store is not active', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue({ ...sampleStore, active: false } as any);
      const res = await request(app).get(`/${storeId}`);
      expect(res.status).toBe(404);
    });
  });

  // --- GET /slug/:slug ---
  describe('GET /slug/:slug', () => {
    it('should return a store by slug', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(sampleStore as any);
      const res = await request(app).get(`/slug/${sampleStore.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(storeId);
    });
  });

  // --- PUT /:storeId ---
  describe('PUT /:storeId', () => {
    it('should update store details with valid data', async () => {
      const updateData = { name: 'New Store Name' };
      mockedPrisma.store.update.mockResolvedValue({ ...sampleStore, ...updateData } as any);
      const res = await request(app).put(`/${storeId}`).send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Store Name');
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app).put(`/${storeId}`).send({ primaryColor: 'not-a-hex' });
      expect(res.status).toBe(400);
    });
  });

  // --- PUT /:storeId/settings ---
  describe('PUT /:storeId/settings', () => {
    it('should update settings and encrypt secrets', async () => {
      const settingsData = { stripeSecretKey: 'sk_test_123', geminiApiKey: 'gem_123' };
      const upsertResult = { storeId, stripeSecretKey: 'encrypted-sk_test_123', geminiApiKeyEnc: 'encrypted-gem_123' };
      mockedPrisma.storeSettings.upsert.mockResolvedValue(upsertResult as any);

      const res = await request(app).put(`/${storeId}/settings`).send(settingsData);

      expect(res.status).toBe(200);
      expect(mockedEncryption.encrypt).toHaveBeenCalledWith('sk_test_123');
      expect(mockedEncryption.encrypt).toHaveBeenCalledWith('gem_123');
      expect(mockedPrisma.storeSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: expect.objectContaining({ stripeSecretKey: 'encrypted-sk_test_123' }),
      }));
      expect(res.body.stripeSecretKey).toBe('***configured***');
      expect(res.body.geminiApiKeyEnc).toBe('***configured***');
    });
  });

  // --- GET / ---
  describe('GET / (Super Admin)', () => {
    it('should return a list of all stores', async () => {
      mockedPrisma.store.findMany.mockResolvedValue([sampleStore] as any);
      mockedPrisma.store.count.mockResolvedValue(1);
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.stores[0].id).toBe(storeId);
      expect(res.body.total).toBe(1);
    });
  });

  // --- PATCH /:storeId/active ---
  describe('PATCH /:storeId/active (Super Admin)', () => {
    it('should toggle the active state of a store', async () => {
      const updatePayload = { active: false };
      mockedPrisma.store.update.mockResolvedValue({ ...sampleStore, ...updatePayload } as any);
      const res = await request(app).patch(`/${storeId}/active`).send(updatePayload);
      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      expect(mockedPrisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { active: false },
      }));
    });
  });
});
