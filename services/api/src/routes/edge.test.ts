import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient, ApiKey } from '@prisma/client';
import edgeRouter from './edge';
import { prisma } from '../db';
import { ProductService } from '../services/product.service';
import { OrderService } from '../services/order.service';

// --- Mocks ---
jest.mock('../db', () => ({
    __esModule: true,
    prisma: {
        ...mockDeep<PrismaClient>(),
        apiKey: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock('../utils/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        http: jest.fn(),
    },
}));

jest.mock('../services/product.service');
jest.mock('../services/order.service');

// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/', edgeRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Edge API Routes', () => {
    const storeId = 'store-456';
    const validKey = 'edge_live_valid';
    const invalidKey = 'edge_live_invalid';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Middleware: requireApiKey', () => {
        it('should reject requests without authorization header', async () => {
            const res = await request(app).get('/products');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('API Key required');
        });

        it('should reject requests with invalid API keys', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce(null);
            const res = await request(app).get('/products').set('Authorization', `Bearer ${invalidKey}`);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid or inactive API Key');
        });

        it('should allow requests with valid API keys and active stores', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce({
                storeId,
                store: { active: true }
            } as any);

            mockedPrisma.apiKey.update.mockResolvedValueOnce({} as any);
            (ProductService.listProducts as jest.Mock).mockResolvedValueOnce({ products: [], total: 0, categories: [] });

            const res = await request(app).get('/products').set('Authorization', `Bearer ${validKey}`);
            expect(res.status).toBe(200);
            expect(ProductService.listProducts).toHaveBeenCalledWith(expect.objectContaining({ storeId }));
        });

        it('should reject requests with malformed headers (missing Bearer)', async () => {
            const res = await request(app).get('/products').set('Authorization', `invalid_format_key`);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('API Key required');
        });

        it('should reject requests if the associated store is inactive', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce({
                storeId,
                store: { active: false }
            } as any);
            const res = await request(app).get('/products').set('Authorization', `Bearer ${validKey}`);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid or inactive API Key');
        });

        it('should return 500 if database query for API key fails', async () => {
            mockedPrisma.apiKey.findUnique.mockRejectedValueOnce(new Error('Database connection failed'));
            const res = await request(app).get('/products').set('Authorization', `Bearer ${validKey}`);
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Internal server error');
        });
    });

    describe('GET /products', () => {
        it('should call ProductService.listProducts with storeId', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce({ storeId, store: { active: true } } as any);
            mockedPrisma.apiKey.update.mockResolvedValueOnce({} as any);

            const mockResult = { products: [{ id: 'p1', name: 'Product 1' }], total: 1, categories: [] };
            (ProductService.listProducts as jest.Mock).mockResolvedValueOnce(mockResult);

            const res = await request(app).get('/products').set('Authorization', `Bearer ${validKey}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockResult);
            expect(ProductService.listProducts).toHaveBeenCalled();
        });
    });

    describe('GET /products/:productId', () => {
        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/products/p1');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('API Key required');
        });

        it('should return the product if authorized', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce({ storeId, store: { active: true } } as any);
            mockedPrisma.apiKey.update.mockResolvedValueOnce({} as any);

            const mockProduct = { id: 'p1', name: 'Product 1' };
            (ProductService.getProductById as jest.Mock).mockResolvedValueOnce(mockProduct);

            const res = await request(app).get('/products/p1').set('Authorization', `Bearer ${validKey}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockProduct);
            expect(ProductService.getProductById).toHaveBeenCalledWith(storeId, 'p1', undefined);
        });
    });

    describe('POST /checkout', () => {
        it('should call OrderService.createOrder and return the order', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce({ storeId, store: { active: true } } as any);
            mockedPrisma.apiKey.update.mockResolvedValueOnce({} as any);

            const checkoutPayload = {
                customerEmail: 'test@example.com',
                customerName: 'Test',
                shippingAddress: { line1: 'Street', city: 'City', state: 'State', zip: '12345' },
                items: [{ productId: 'p1', quantity: 1 }]
            };

            const mockOrder = { id: 'ord-123', total: 100 };
            (OrderService.createOrder as jest.Mock).mockResolvedValueOnce(mockOrder);

            const res = await request(app)
                .post('/checkout')
                .set('Authorization', `Bearer ${validKey}`)
                .send(checkoutPayload);

            expect(res.status).toBe(201);
            expect(res.body).toEqual(mockOrder);
            expect(OrderService.createOrder).toHaveBeenCalledWith(storeId, expect.objectContaining({
                ...checkoutPayload,
                storeId,
                shippingAddress: {
                    ...checkoutPayload.shippingAddress,
                    country: 'US'
                }
            }), undefined);
        });

        it('should reject invalid checkout payloads', async () => {
            mockedPrisma.apiKey.findUnique.mockResolvedValueOnce({ storeId, store: { active: true } } as any);
            mockedPrisma.apiKey.update.mockResolvedValueOnce({} as any);

            const res = await request(app)
                .post('/checkout')
                .set('Authorization', `Bearer ${validKey}`)
                .send({ customerEmail: 'not-an-email' }); // Invalid email, missing fields

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid input');
        });

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).post('/checkout').send({ customerEmail: 'not-an-email' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('API Key required');
        });
    });
});
