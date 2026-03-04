import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import productRouter from './products';
import { prisma } from '../db';
import { logger } from '../utils/logger';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../middleware/auth', () => ({
  requireStoreAdmin: (req: any, res: any, next: any) => next(),
  optionalAuth: (req: any, res: any, next: any) => next(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    http: jest.fn(),
  },
}));

// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/', productRouter); // Mount the router

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Product Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'cl-store-123';
  const sampleProduct = {
    id: 'prod-1',
    storeId,
    name: 'Test Product',
    description: 'A test product',
    price: 100,
    comparePrice: 120,
    stock: 10,
    trackStock: true,
    category: 'Test',
    tags: ['tag1'],
    images: ['http://example.com/img.png'],
    variants: { color: 'red' },
    modelUrl: null,
    arEnabled: false,
    weight: 1,
    active: true,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sku: 'SKU123',
  } as any;

  // --- GET /:storeId/products ---
  describe('GET /:storeId/products', () => {
    it('should return a list of products with total and categories', async () => {
      // The findMany for products list
      mockedPrisma.product.findMany.mockResolvedValueOnce([sampleProduct]);
      // The findMany for categories
      mockedPrisma.product.findMany.mockResolvedValueOnce([{ category: 'Test' }] as any);
      mockedPrisma.product.count.mockResolvedValueOnce(1);

      const res = await request(app).get(`/${storeId}/products`);

      expect(res.status).toBe(200);
      // We need to serialize the date fields to match the JSON response
      const expectedProduct = JSON.parse(JSON.stringify(sampleProduct));
      expect(res.body.products).toEqual([expectedProduct]);
      expect(res.body.total).toBe(1);
      expect(res.body.categories).toEqual(['Test']);
      expect(mockedPrisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId, active: true } }));
    });

    it('should handle database errors gracefully', async () => {
      mockedPrisma.product.findMany.mockRejectedValue(new Error('DB Error'));
      const res = await request(app).get(`/${storeId}/products`);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // --- GET /:storeId/products/:productId ---
  describe('GET /:storeId/products/:productId', () => {
    it('should return a single product if found', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(sampleProduct);
      const res = await request(app).get(`/${storeId}/products/${sampleProduct.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(JSON.parse(JSON.stringify(sampleProduct)));
    });

    it('should return 404 if product not found', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(null);
      const res = await request(app).get(`/${storeId}/products/prod-not-found`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Product not found');
    });
  });

  // --- POST /:storeId/products ---
  describe('POST /:storeId/products', () => {
    it('should create a new product with valid data', async () => {
      const newProductData = { name: 'New Gadget', price: 99.99, stock: 50 };
      const createdProduct = { ...sampleProduct, ...newProductData, id: 'prod-2' };
      mockedPrisma.product.create.mockResolvedValue(createdProduct);

      const res = await request(app).post(`/${storeId}/products`).send(newProductData);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(JSON.parse(JSON.stringify(createdProduct)));
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app).post(`/${storeId}/products`).send({ name: 'Only Name' }); // Price is missing
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid input');
    });
  });

  // --- PUT /:storeId/products/:productId ---
  describe('PUT /:storeId/products/:productId', () => {
    it('should update an existing product', async () => {
      const updateData = { name: 'Updated Product Name' };
      const updatedProduct = { ...sampleProduct, ...updateData };
      mockedPrisma.product.findFirst.mockResolvedValue(sampleProduct);
      mockedPrisma.product.update.mockResolvedValue(updatedProduct);

      const res = await request(app).put(`/${storeId}/products/${sampleProduct.id}`).send(updateData);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(JSON.parse(JSON.stringify(updatedProduct)));
    });

    it('should return 404 if product to update is not found', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(null);
      const res = await request(app).put(`/${storeId}/products/prod-not-found`).send({ name: 'Does not matter' });
      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /:storeId/products/:productId ---
  describe('DELETE /:storeId/products/:productId', () => {
    it('should soft-delete a product', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(sampleProduct);
      mockedPrisma.product.update.mockResolvedValue({ ...sampleProduct, active: false } as any);

      const res = await request(app).delete(`/${storeId}/products/${sampleProduct.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockedPrisma.product.update).toHaveBeenCalledWith({
        where: { id: sampleProduct.id },
        data: { active: false },
      });
    });

    it('should return 404 if product to delete is not found', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(null);
      const res = await request(app).delete(`/${storeId}/products/prod-not-found`);
      expect(res.status).toBe(404);
    });
  });

  // --- POST /:storeId/products/:productId/generate-3d ---
  describe('POST /:storeId/products/:productId/generate-3d', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return 202 and simulate 3D generation if product has images', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(sampleProduct as any);

      const res = await request(app).post(`/${storeId}/products/${sampleProduct.id}/generate-3d`);
      expect(res.status).toBe(202);
      expect(res.body.message).toBe('3D generation started');

      // Fast-forward timers to trigger the setTimeout callback
      await jest.runAllTimersAsync();

      expect(mockedPrisma.product.update).toHaveBeenCalledWith({
        where: { id: sampleProduct.id },
        data: {
          modelUrl: expect.any(String),
          arEnabled: true,
        },
      });
    });

    it('should return 400 if product has no images', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue({ ...sampleProduct, images: [] } as any);

      const res = await request(app).post(`/${storeId}/products/${sampleProduct.id}/generate-3d`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Product must have at least one image to generate a 3D model');
    });

    it('should return 404 if product not found', async () => {
      mockedPrisma.product.findFirst.mockResolvedValue(null);

      const res = await request(app).post(`/${storeId}/products/prod-not-found/generate-3d`);
      expect(res.status).toBe(404);
    });
  });

  // --- POST /:storeId/products/bulk-import ---
  describe('POST /:storeId/products/bulk-import', () => {
    it('should bulk import valid products', async () => {
      const productsToImport = [{ name: 'Bulk 1', price: 10 }, { name: 'Bulk 2', price: 20 }];
      mockedPrisma.product.createMany.mockResolvedValue({ count: 2 });

      const res = await request(app).post(`/${storeId}/products/bulk-import`).send({ products: productsToImport });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(2);
      expect(res.body.failed).toBe(0);
    });

    it('should report errors for invalid products in the batch', async () => {
      const productsToImport = [{ name: 'Valid', price: 10 }, { name: 'Invalid' }]; // Missing price
      mockedPrisma.product.createMany.mockResolvedValue({ count: 1 });

      const res = await request(app).post(`/${storeId}/products/bulk-import`).send({ products: productsToImport });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(1);
      expect(res.body.failed).toBe(1);
      expect(res.body.errors[0].index).toBe(1);
    });

    it('should return 400 if products array is missing', async () => {
      const res = await request(app).post(`/${storeId}/products/bulk-import`).send({ foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Products array required');
    });
  });
});