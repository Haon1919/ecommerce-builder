import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import chatRouter from './chat';
import { prisma } from '../db';
import * as Gemini from '../services/gemini';
import * as Encryption from '../services/encryption';
import * as Anomaly from '../services/anomaly';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));
jest.mock('../services/gemini');
jest.mock('../services/encryption');
jest.mock('../services/anomaly');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    logging: { level: 'info' },
    encryption: { key: 'a-super-secret-key-for-testing-purposes' },
  }
}));
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));


// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/', chatRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedGemini = Gemini as jest.Mocked<typeof Gemini>;
const mockedEncryption = Encryption as jest.Mocked<typeof Encryption>;
const mockedAnomaly = Anomaly as jest.Mocked<typeof Anomaly>;
const mockedCrypto = crypto as jest.Mocked<typeof crypto>;

describe('Chat Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'cl-store-123';
  const store = { id: storeId, active: true, settings: { geminiApiKeyEnc: 'enc-key' } };
  const session = { id: 'session-1', storeId, messages: [] };

  // --- POST /:storeId/chat ---
  describe('POST /:storeId/chat', () => {
    it('should create a new session and return a chat response', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedPrisma.chatSession.findUnique.mockResolvedValue(null); // No existing session
      mockedCrypto.randomUUID.mockReturnValue('a-valid-uuid-like-string-for-testing');
      mockedPrisma.chatSession.create.mockResolvedValue(session as any);
      mockedEncryption.decrypt.mockReturnValue('decrypted-gemini-key');
      mockedGemini.processChat.mockResolvedValue({ text: 'Hello from AI', action: null });

      const res = await request(app).post(`/${storeId}/chat`).send({ message: 'Hello' });

      expect(res.status).toBe(200);
      expect(mockedPrisma.chatSession.create).toHaveBeenCalled();
      expect(mockedGemini.processChat).toHaveBeenCalledWith(storeId, 'Hello', [], 'decrypted-gemini-key', undefined);
      expect(mockedPrisma.chatMessage.createMany).toHaveBeenCalled();
      expect(res.body.message).toBe('Hello from AI');
      expect(res.body.sessionId).toBe(session.id);
    });

    it('should use an existing session and return a chat response', async () => {
      const existingSession = { ...session, messages: [{ role: 'USER', content: 'Old message' }] };
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedPrisma.chatSession.findUnique.mockResolvedValue(existingSession as any);
      mockedGemini.processChat.mockResolvedValue({ text: 'Replying to existing', action: null });

      const res = await request(app).post(`/${storeId}/chat`).send({ sessionId: session.id, message: 'New message' });

      expect(res.status).toBe(200);
      expect(mockedPrisma.chatSession.create).not.toHaveBeenCalled();
      expect(mockedGemini.processChat).toHaveBeenCalledWith(storeId, 'New message', expect.any(Array), 'decrypted-gemini-key', undefined);
      expect(res.body.message).toBe('Replying to existing');
    });

    it('should block off-topic queries and not call Gemini', async () => {
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedPrisma.chatSession.findUnique.mockResolvedValue(null);
      mockedCrypto.randomUUID.mockReturnValue('12345678-1234-1234-1234-123456789012');
      mockedPrisma.chatSession.create.mockResolvedValue(session as any);

      // Reset mock just to be safe
      mockedGemini.processChat.mockClear();

      const res = await request(app).post(`/${storeId}/chat`).send({ message: 'Write a poem about the sea' });

      expect(res.status).toBe(200);
      expect(mockedGemini.processChat).not.toHaveBeenCalled();
      expect(res.body.message).toContain("I am a shopping assistant");
    });
  });

  // --- POST /:storeId/chat/event-recommendations ---
  describe('POST /:storeId/chat/event-recommendations', () => {
    it('should return enriched product recommendations', async () => {
      const recommendation = { products: [{ id: 'prod-1', reason: 'Good for parties' }] };
      const product = { id: 'prod-1', name: 'Party Speaker', price: 100 };
      mockedPrisma.store.findUnique.mockResolvedValue(store as any);
      mockedGemini.getEventRecommendations.mockResolvedValue(recommendation as any);
      mockedPrisma.product.findMany.mockResolvedValue([product] as any);

      const res = await request(app).post(`/${storeId}/chat/event-recommendations`).send({ event: 'a birthday party' });

      expect(res.status).toBe(200);
      expect(mockedGemini.getEventRecommendations).toHaveBeenCalled();
      expect(mockedPrisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: { in: ['prod-1'] }, storeId, active: true },
      }));
      expect(res.body.products[0].product.name).toBe('Party Speaker');
    });
  });

  // --- GET /:storeId/chat/history/:sessionId ---
  describe('GET /:storeId/chat/history/:sessionId', () => {
    it('should return chat history for a valid session', async () => {
      const historySession = { ...session, messages: [{ id: 'msg-1', role: 'USER', content: 'Hi' }] };
      mockedPrisma.chatSession.findFirst.mockResolvedValue(historySession as any);

      const res = await request(app).get(`/${storeId}/chat/history/${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(1);
      expect(res.body.messages[0].content).toBe('Hi');
    });

    it('should return 404 if session not found', async () => {
      mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
      const res = await request(app).get(`/${storeId}/chat/history/not-found`);
      expect(res.status).toBe(404);
    });
  });
});
