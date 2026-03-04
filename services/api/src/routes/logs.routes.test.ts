import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import logsRouter, { setSocketIO, emitLog } from './logs';
import { prisma } from '../db';
import { Server } from 'socket.io';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));
jest.mock('../middleware/auth', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => next(),
}));
jest.mock('../utils/logger');
jest.mock('../config', () => ({ config: { logging: { level: 'info' } } }));

// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/logs', logsRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Logs Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset socket.io instance for each test
    setSocketIO(null as any);
  });

  const sampleLog = { id: 'log-1', level: 'INFO', message: 'Test log' };

  // --- GET /logs ---
  describe('GET /logs', () => {
    it('should return a paginated list of logs', async () => {
      mockedPrisma.appLog.findMany.mockResolvedValue([sampleLog] as any);
      mockedPrisma.appLog.count.mockResolvedValue(1);

      const res = await request(app).get('/logs?limit=10&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.logs[0].id).toBe('log-1');
      expect(res.body.total).toBe(1);
      expect(mockedPrisma.appLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 10,
        skip: 0,
      }));
    });

    it('should filter logs by level', async () => {
        await request(app).get('/logs?level=ERROR');
        expect(mockedPrisma.appLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { level: 'ERROR' },
        }));
    });
  });

  // --- GET /logs/stats ---
  describe('GET /logs/stats', () => {
    it('should return log stats and trends', async () => {
        const stats = [{ level: 'INFO', _count: { id: 100 } }];
        const trend = [{ minute: '2024-01-01T00:00:00Z', errors: 1, total: 100 }];
        mockedPrisma.appLog.groupBy.mockResolvedValue(stats as any);
        mockedPrisma.$queryRaw.mockResolvedValue(trend);

        const res = await request(app).get('/logs/stats');

        expect(res.status).toBe(200);
        expect(res.body.stats).toEqual(stats);
        expect(res.body.trend).toEqual(trend);
    });
  });

  // --- emitLog function ---
  describe('emitLog', () => {
    it('should emit a log event to the super-admin-logs room if socket.io is configured', () => {
        const mockEmit = jest.fn();
        const mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: mockEmit,
        };
        setSocketIO(mockIo as any as Server);

        const logToEmit = { id: 'log-2', level: 'ERROR', message: 'Real-time error', timestamp: new Date(), service: 'api' };
        emitLog(logToEmit);

        expect(mockIo.to).toHaveBeenCalledWith('super-admin-logs');
        expect(mockEmit).toHaveBeenCalledWith('log', logToEmit);
    });

    it('should not throw an error if socket.io is not configured', () => {
        const logToEmit = { id: 'log-2', level: 'ERROR', message: 'Real-time error', timestamp: new Date(), service: 'api' };
        // Should not throw
        expect(() => emitLog(logToEmit)).not.toThrow();
    });
  });
});
