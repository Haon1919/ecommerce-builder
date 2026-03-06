import { Request, Response, NextFunction } from 'express';
import {
  requestLogger,
  responseTime,
  scrubPIIForSuperAdmin,
  getAndResetRequestCount,
} from './security';

jest.mock('../db', () => ({
  prisma: {
    appLog: { create: jest.fn().mockResolvedValue({}) },
    metricSnapshot: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

type FinishableRes = Response & { _emit: (event: string) => void };

const makeRes = (statusCode = 200): FinishableRes => {
  const handlers: Record<string, () => void> = {};
  const res: any = {
    statusCode,
    on: jest.fn((event: string, cb: () => void) => { handlers[event] = cb; }),
    setHeader: jest.fn(),
    writeHead: jest.fn(),
    json: jest.fn(function (this: any, body: unknown) { return this; }),
    _emit: (event: string) => handlers[event]?.(),
  };
  return res as FinishableRes;
};

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({ method: 'GET', path: '/test', headers: {}, ...overrides } as unknown as Request);

const mockNext = jest.fn() as unknown as NextFunction;

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestLogger', () => {
    it('calls next()', () => {
      requestLogger(makeReq(), makeRes(), mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('generates and attaches an x-trace-id when none is present', () => {
      const req = makeReq();
      requestLogger(req, makeRes(), mockNext);
      expect(req.headers['x-trace-id']).toBeDefined();
      expect(typeof req.headers['x-trace-id']).toBe('string');
    });

    it('preserves an existing x-trace-id header', () => {
      const req = makeReq({ headers: { 'x-trace-id': 'my-trace-123' } });
      requestLogger(req, makeRes(), mockNext);
      expect(req.headers['x-trace-id']).toBe('my-trace-123');
    });

    it('increments the request count when the response finishes', async () => {
      getAndResetRequestCount(); // reset counter to 0
      const res = makeRes();
      requestLogger(makeReq(), res, mockNext);
      res._emit('finish');
      // Allow the fire-and-forget async DB write to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getAndResetRequestCount()).toBe(1);
    });

    it('resets the request count to 0 after reading', async () => {
      getAndResetRequestCount();
      const res = makeRes();
      requestLogger(makeReq(), res, mockNext);
      res._emit('finish');
      await new Promise((resolve) => setTimeout(resolve, 10));
      getAndResetRequestCount(); // reads and resets
      expect(getAndResetRequestCount()).toBe(0);
    });
  });

  describe('responseTime', () => {
    it('calls next()', () => {
      responseTime(makeReq(), makeRes(), mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets the X-Response-Time header when the response finishes', () => {
      const res = makeRes();
      responseTime(makeReq(), res, mockNext);
      res._emit('finish');
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.stringMatching(/^\d+(\.\d+)?ms$/)
      );
    });
  });

  describe('scrubPIIForSuperAdmin', () => {
    it('calls next()', () => {
      const res = makeRes();
      scrubPIIForSuperAdmin(makeReq(), res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('passes response body through unchanged for non-super-admin users', () => {
      const req = makeReq({ user: { sub: 'u1', email: 'a@b.com', role: 'ADMIN', type: 'USER' } } as any);
      const res = makeRes();

      let capturedBody: unknown;
      res.json = jest.fn((body: unknown) => { capturedBody = body; return res; }) as any;
      const originalJsonMock = res.json;

      scrubPIIForSuperAdmin(req, res, mockNext);

      const body = { id: 'ord-1', customerEmailEnc: 'encrypted-secret', total: 99 };
      res.json(body);

      // originalJson (the saved mock) should have been called with the unmodified body
      expect(originalJsonMock).toHaveBeenCalledWith(body);
    });

    it('redacts known PII fields in responses for super admins', () => {
      const req = makeReq({ user: { type: 'SUPER_ADMIN' } } as any);
      const res = makeRes();

      let capturedBody: unknown;
      res.json = jest.fn((body: unknown) => { capturedBody = body; return res; }) as any;

      scrubPIIForSuperAdmin(req, res, mockNext);

      res.json({
        id: 'ord-1',
        customerEmailEnc: 'encrypted-email',
        customerNameEnc: 'encrypted-name',
        total: 150,
      });

      expect(capturedBody).toEqual({
        id: 'ord-1',
        customerEmailEnc: '[REDACTED]',
        customerNameEnc: '[REDACTED]',
        total: 150,
      });
    });

    it('redacts PII inside nested arrays for super admins', () => {
      const req = makeReq({ user: { type: 'SUPER_ADMIN' } } as any);
      const res = makeRes();

      let capturedBody: unknown;
      res.json = jest.fn((body: unknown) => { capturedBody = body; return res; }) as any;

      scrubPIIForSuperAdmin(req, res, mockNext);

      res.json({
        orders: [
          { id: 'ord-1', customerEmailEnc: 'secret-email', total: 100 },
          { id: 'ord-2', shippingAddrEnc: 'secret-addr', total: 200 },
        ],
      });

      expect(capturedBody).toEqual({
        orders: [
          { id: 'ord-1', customerEmailEnc: '[REDACTED]', total: 100 },
          { id: 'ord-2', shippingAddrEnc: '[REDACTED]', total: 200 },
        ],
      });
    });

    it('redacts the password field for super admins', () => {
      const req = makeReq({ user: { type: 'SUPER_ADMIN' } } as any);
      const res = makeRes();

      let capturedBody: unknown;
      res.json = jest.fn((body: unknown) => { capturedBody = body; return res; }) as any;

      scrubPIIForSuperAdmin(req, res, mockNext);

      res.json({ email: 'admin@example.com', password: 'hashed-password-123' });

      expect(capturedBody).toEqual({
        email: 'admin@example.com',
        password: '[REDACTED]',
      });
    });

    it('leaves non-PII fields untouched for super admins', () => {
      const req = makeReq({ user: { type: 'SUPER_ADMIN' } } as any);
      const res = makeRes();

      let capturedBody: unknown;
      res.json = jest.fn((body: unknown) => { capturedBody = body; return res; }) as any;

      scrubPIIForSuperAdmin(req, res, mockNext);

      res.json({ id: 'store-1', name: 'My Shop', revenue: 5000 });

      expect(capturedBody).toEqual({ id: 'store-1', name: 'My Shop', revenue: 5000 });
    });
  });
});
