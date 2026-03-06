import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import authRouter from './auth';
import { prisma } from '../db';
import * as AuthMiddleware from '../middleware/auth';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('bcryptjs');
jest.mock('../middleware/auth');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: { logging: { level: 'info' } },
}));


// --- Test Setup ---
const app = express();
app.use(express.json());
// Mock requireAuth to attach user for the /me route
const mockedAuthMiddleware = AuthMiddleware as jest.Mocked<typeof AuthMiddleware>;
mockedAuthMiddleware.requireAuth.mockImplementation((req: any, res: any, next: any) => {
  if (req.headers['authorization']) {
    req.user = JSON.parse(Buffer.from(req.headers['authorization'].split('.')[1], 'base64').toString());
  }
  next();
});
app.use('/', authRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
// Cast to any to avoid type issues with mockImplementation
const mockedCompare = mockedBcrypt.compare as any;
const mockedHash = mockedBcrypt.hash as any;

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeAdmin = { id: 'user-1', email: 'admin@store.com', password: 'hashed_password', active: true, roleId: 'role-1', role: { id: 'role-1', name: 'Owner' } };
  const store = { id: 'store-1', slug: 'test-store', name: 'Test Store', active: true };
  const superAdmin = { id: 'sa-1', email: 'super@admin.com', password: 'hashed_password', active: true, name: 'Super' };

  // --- POST /login (Store Admin) ---
  describe('POST /login (Store Admin)', () => {
    it('should login a store admin and return a token', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedPrisma.user.findUnique.mockResolvedValue(storeAdmin as any);
      mockedCompare.mockImplementation(() => Promise.resolve(true));
      mockedAuthMiddleware.signToken.mockReturnValue('fake-jwt-token');

      const res = await request(app).post('/login').send({ email: storeAdmin.email, password: 'password123', storeSlug: store.slug });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe('fake-jwt-token');
      expect(res.body.user.email).toBe(storeAdmin.email);
      expect(res.body.store.slug).toBe(store.slug);
    });

    it('should return 401 for invalid store admin password', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedPrisma.user.findUnique.mockResolvedValue(storeAdmin as any);
      mockedCompare.mockImplementation(() => Promise.resolve(false)); // Invalid password

      const res = await request(app).post('/login').send({ email: storeAdmin.email, password: 'wrongpassword', storeSlug: store.slug });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app).post('/login').send({ email: 'not-an-email', password: 'password123', storeSlug: store.slug });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid input');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app).post('/login').send({ email: storeAdmin.email, storeSlug: store.slug }); // missing password
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid input');
    });

    it('should return 401 for inactive store login attempt', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue({ ...store, active: false } as any);
      const res = await request(app).post('/login').send({ email: storeAdmin.email, password: 'password123', storeSlug: store.slug });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Store not found');
    });

    it('should return 401 for inactive user login attempt', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedPrisma.user.findUnique.mockResolvedValue({ ...storeAdmin, active: false } as any);
      const res = await request(app).post('/login').send({ email: storeAdmin.email, password: 'password123', storeSlug: store.slug });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  // --- POST /login (Super Admin) ---
  describe('POST /login (Super Admin)', () => {
    it('should login a super admin and return a token', async () => {
      mockedPrisma.superAdmin.findUnique.mockResolvedValue(superAdmin as any);
      mockedCompare.mockImplementation(() => Promise.resolve(true));
      mockedAuthMiddleware.signToken.mockReturnValue('super-admin-token');

      const res = await request(app).post('/login').send({ email: superAdmin.email, password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe('super-admin-token');
      expect(res.body.user.role).toBe('SUPER_ADMIN');
    });

    it('should return 401 for invalid super admin password', async () => {
      mockedPrisma.superAdmin.findUnique.mockResolvedValue(superAdmin as any);
      mockedCompare.mockImplementation(() => Promise.resolve(false));

      const res = await request(app).post('/login').send({ email: superAdmin.email, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  // --- POST /register ---
  describe('POST /register', () => {
    it('should register a new user and store', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(null); // Slug is available
      mockedHash.mockImplementation(() => Promise.resolve('new_hashed_password'));
      const ownerRole = { id: 'role-1', name: 'Owner', storeId: 'new-store', isStatic: true, description: '' };
      const createdStore = { id: 'new-store', slug: 'new-store', name: 'New Store', roles: [ownerRole] };
      mockedPrisma.store.create.mockResolvedValue(createdStore as any);

      const createdUser = { id: 'new-user', email: 'new@user.com', name: 'New User', roleId: ownerRole.id, role: ownerRole };
      mockedPrisma.user.create.mockResolvedValue(createdUser as any);

      mockedAuthMiddleware.signToken.mockReturnValue('new-user-token');

      const res = await request(app).post('/register').send({
        email: 'new@user.com',
        password: 'password123',
        name: 'New User',
        storeSlug: 'new-store',
        storeName: 'New Store',
      });

      expect(res.status).toBe(201);
      expect(mockedPrisma.store.create).toHaveBeenCalled();
      expect(res.body.token).toBe('new-user-token');
    });

    it('should return 409 if store slug is taken', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(store as any); // Slug exists
      const res = await request(app).post('/register').send({
        email: 'new@user.com',
        password: 'password123',
        name: 'New User',
        storeSlug: store.slug,
        storeName: 'New Store',
      });
      expect(res.status).toBe(409);
    });

    it('should return 400 for registration with short password', async () => {
      const res = await request(app).post('/register').send({
        email: 'new@user.com',
        password: 'short',
        name: 'New User',
        storeSlug: 'new-store',
        storeName: 'New Store',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid input');
    });
  });

  // --- GET /me ---
  describe('GET /me', () => {
    it('should return the current user profile', async () => {
      const userPayload = { sub: storeAdmin.id, type: 'USER' };
      const fakeToken = `header.${Buffer.from(JSON.stringify(userPayload)).toString('base64')}.sig`;
      mockedPrisma.user.findUnique.mockResolvedValue(storeAdmin as any);

      const res = await request(app).get('/me').set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(storeAdmin.id);
    });

    it('should return 401 for expired or invalid token', async () => {
      mockedAuthMiddleware.requireAuth.mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Invalid or expired token' });
      });

      const res = await request(app).get('/me').set('Authorization', 'Bearer invalidtoken');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });
});
