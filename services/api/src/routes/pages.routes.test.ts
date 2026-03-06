import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import pagesRouter from './pages';
import { prisma } from '../db';
import * as AuthMiddleware from '../middleware/auth';
import * as GeminiService from '../services/gemini';
import { SubscriptionTier } from '../middleware/tier';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));
jest.mock('../middleware/auth');
jest.mock('../services/gemini');
jest.mock('../utils/logger');
jest.mock('../config', () => ({ config: { logging: { level: 'info' }, features: { bypassTierChecks: false } } }));

// --- Test Setup ---
const app = express();
app.use(express.json());
const mockedAuth = AuthMiddleware as jest.Mocked<typeof AuthMiddleware>;
mockedAuth.requireStoreAdmin.mockImplementation((req: any, res: any, next: any) => next());
mockedAuth.optionalAuth.mockImplementation((req: any, res: any, next: any) => {
  if (req.headers['authorization']?.includes('admin')) {
    req.user = { storeId: 'store-1', type: 'USER' };
  }
  next();
});
app.use('/', pagesRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedGemini = GeminiService as jest.Mocked<typeof GeminiService>;

describe('Pages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'store-1';
  const pageId = 'page-1';
  const samplePage = { id: pageId, storeId, slug: 'home', title: 'Home', published: true, layout: '[]' };
  const unpublishedPage = { ...samplePage, id: 'page-2', slug: 'draft', published: false };

  // --- GET /:storeId/pages ---
  describe('GET /:storeId/pages', () => {
    it('should return a list of pages for the store', async () => {
      mockedPrisma.page.findMany.mockResolvedValue([samplePage] as any);
      const res = await request(app).get(`/${storeId}/pages`).set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].slug).toBe('home');
    });
  });

  // --- GET /:storeId/layout/generate ---
  describe('GET /:storeId/layout/generate', () => {
    it('should return 403 for STARTER tier', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue({ id: storeId, tier: SubscriptionTier.STARTER } as any);
      const res = await request(app).get(`/${storeId}/layout/generate`);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'Subscription tier too low',
        requiredTier: 'ENTERPRISE',
        currentTier: 'STARTER',
      });
    });

    it('should return 403 for GROWTH tier', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue({ id: storeId, tier: SubscriptionTier.GROWTH } as any);
      const res = await request(app).get(`/${storeId}/layout/generate`);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'Subscription tier too low',
        requiredTier: 'ENTERPRISE',
        currentTier: 'GROWTH',
      });
    });

    it('should return 404 if the store is not found', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(null);
      const res = await request(app).get(`/${storeId}/layout/generate`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Store not found');
    });

    it('should return a layout for Enterprise tier', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue({ id: storeId, tier: SubscriptionTier.ENTERPRISE } as any);
      mockedGemini.generateStoreLayout.mockResolvedValue([{ id: 'test', type: 'HeroSection', order: 0, props: {} }]);
      const res = await request(app).get(`/${storeId}/layout/generate`);
      expect(res.status).toBe(200);
      expect(res.body.layout).toBeDefined();
      expect(res.body.layout[0].type).toBe('HeroSection');
    });
  });

  // --- GET /:storeId/pages/:slug ---
  describe('GET /:storeId/pages/:slug', () => {
    it('should return a published page to the public', async () => {
      mockedPrisma.page.findFirst.mockResolvedValue(samplePage as any);
      const res = await request(app).get(`/${storeId}/pages/home`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(pageId);
    });

    it('should return 404 for an unpublished page to the public', async () => {
      mockedPrisma.page.findFirst.mockResolvedValue(null);
      const res = await request(app).get(`/${storeId}/pages/draft`);
      expect(res.status).toBe(404);
    });

    it('should return an unpublished page to an admin', async () => {
      mockedPrisma.page.findFirst.mockResolvedValue(unpublishedPage as any);
      const res = await request(app).get(`/${storeId}/pages/draft`).set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('page-2');
    });
  });

  // --- POST /:storeId/pages ---
  describe('POST /:storeId/pages', () => {
    it('should create a new page', async () => {
      const newPageData = { slug: 'new-page', title: 'New Page', layout: [] };
      mockedPrisma.page.findFirst.mockResolvedValue(null); // No existing page
      mockedPrisma.page.create.mockResolvedValue({ ...newPageData, id: 'new-id' } as any);

      const res = await request(app).post(`/${storeId}/pages`).send(newPageData);

      expect(res.status).toBe(201);
      expect(mockedPrisma.page.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ layout: '[]' }) // Check for stringification
      }));
    });
  });

  // --- PUT /:storeId/pages/:pageId ---
  describe('PUT /:storeId/pages/:pageId', () => {
    it('should update a page', async () => {
      const updateData = { title: 'Updated Title', layout: [{ id: 'comp-1', type: 'Text', order: 0, props: {} }] };
      mockedPrisma.page.findFirst.mockResolvedValue(samplePage as any);
      mockedPrisma.page.update.mockResolvedValue({ ...samplePage, ...updateData } as any);

      const res = await request(app).put(`/${storeId}/pages/${pageId}`).send(updateData);

      expect(res.status).toBe(200);
      expect(mockedPrisma.page.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ layout: JSON.stringify(updateData.layout) })
      }));
    });
  });

  // --- POST /:storeId/pages/:pageId/publish ---
  describe('POST /:storeId/pages/:pageId/publish', () => {
    it('should update the published status of a page', async () => {
      mockedPrisma.page.findFirst.mockResolvedValue(samplePage as any);
      mockedPrisma.page.update.mockResolvedValue({ ...samplePage, published: false } as any);

      const res = await request(app).post(`/${storeId}/pages/${pageId}/publish`).send({ published: false });

      expect(res.status).toBe(200);
      expect(mockedPrisma.page.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: { published: false }
      });
    });
  });

  // --- POST /:storeId/configure ---
  describe('POST /:storeId/configure', () => {
    it('should mark a store as configured', async () => {
      mockedPrisma.store.update.mockResolvedValue({} as any);
      const res = await request(app).post(`/${storeId}/configure`);
      expect(res.status).toBe(200);
      expect(mockedPrisma.store.update).toHaveBeenCalledWith({
        where: { id: storeId },
        data: { configured: true }
      });
    });
  });
});
