import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import messagesRouter from './messages';
import { prisma } from '../db';
import * as Encryption from '../services/encryption';
import * as AuthMiddleware from '../middleware/auth';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));
jest.mock('../services/encryption');
jest.mock('../middleware/auth');
jest.mock('../middleware/auth.permission', () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    req.user = req.user || { sub: 'user-123', type: 'USER', storeId: 'cl-store-123' };
    next();
  },
}));
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    logging: { level: 'info' },
    encryption: { key: 'a-super-secret-key-for-testing-purposes' },
  }
}));

// --- Test Setup ---
const app = express();
app.use(express.json());
const mockedAuth = AuthMiddleware as jest.Mocked<typeof AuthMiddleware>;
mockedAuth.requireStoreAdmin.mockImplementation((req: any, res: any, next: any) => {
  // Attach a mock user for the reply endpoint
  req.user = { sub: 'user-123' };
  next();
});
app.use('/', messagesRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedEncryption = Encryption as jest.Mocked<typeof Encryption>;

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'cl-store-123';
  const messageData = { name: 'John Doe', email: 'john@doe.com', subject: 'Inquiry', message: 'This is a test message.' };
  const sampleMessage = { id: 'msg-1', storeId, nameEnc: 'enc-name', emailEnc: 'enc-email', read: false };

  // --- POST /:storeId/messages ---
  describe('POST /:storeId/messages', () => {
    it('should create a new message and encrypt PII', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue({ id: storeId } as any);
      mockedEncryption.encrypt.mockImplementation((text) => `enc-${text}`);

      const res = await request(app).post(`/${storeId}/messages`).send(messageData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockedEncryption.encrypt).toHaveBeenCalledWith(messageData.name);
      expect(mockedEncryption.encrypt).toHaveBeenCalledWith(messageData.email);
      expect(mockedPrisma.contactMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nameEnc: 'enc-John Doe', emailEnc: 'enc-john@doe.com' }),
      });
    });

    it('should return 404 if store not found', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(null);
      const res = await request(app).post(`/${storeId}/messages`).send(messageData);
      expect(res.status).toBe(404);
    });
  });

  // --- GET /:storeId/messages ---
  describe('GET /:storeId/messages', () => {
    it('should return a list of decrypted messages', async () => {
      mockedPrisma.contactMessage.findMany.mockResolvedValue([sampleMessage] as any);
      mockedPrisma.contactMessage.count.mockResolvedValue(1);
      mockedEncryption.decrypt.mockImplementation((text) => text.replace('enc-', ''));

      const res = await request(app).get(`/${storeId}/messages`);

      expect(res.status).toBe(200);
      expect(res.body.messages[0].name).toBe('name');
      expect(res.body.messages[0].email).toBe('email');
      expect(res.body.messages[0].nameEnc).toBeUndefined();
    });
  });

  // --- GET /:storeId/messages/:messageId ---
  describe('GET /:storeId/messages/:messageId', () => {
    it('should return a single message and mark it as read', async () => {
      mockedPrisma.contactMessage.findFirst.mockResolvedValue(sampleMessage as any);

      const res = await request(app).get(`/${storeId}/messages/msg-1`);

      expect(res.status).toBe(200);
      expect(mockedPrisma.contactMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { read: true },
      });
      expect(res.body.read).toBe(true);
    });
  });

  // --- POST /:storeId/messages/:messageId/reply ---
  describe('POST /:storeId/messages/:messageId/reply', () => {
    it('should create a reply for a message', async () => {
      mockedPrisma.contactMessage.findFirst.mockResolvedValue(sampleMessage as any);
      const replyBody = 'This is a reply from the admin.';
      const createdReply = { id: 'reply-1', body: replyBody, userId: 'user-123' };
      mockedPrisma.messageReply.create.mockResolvedValue(createdReply as any);

      const res = await request(app).post(`/${storeId}/messages/msg-1/reply`).send({ body: replyBody });

      expect(res.status).toBe(201);
      expect(mockedPrisma.messageReply.create).toHaveBeenCalledWith(expect.objectContaining({
        data: {
          messageId: 'msg-1',
          userId: 'user-123', // from mocked middleware
          body: replyBody,
        },
      }));
      expect(res.body.id).toBe('reply-1');
    });
  });
});
