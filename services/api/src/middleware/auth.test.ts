import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  requireAuth,
  requireSuperAdmin,
  requireStoreAdmin,
  requireAdminOrSuperAdmin,
  optionalAuth,
  JwtPayload,
} from './auth';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../db', () => ({
  prisma: {
    appLog: {
      create: jest.fn().mockResolvedValue({})
    }
  }
}));
jest.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
    },
    logging: {
      level: 'silent',
      structured: false,
    },
  },
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

// Helper to create mock Express objects
const getMockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const getMockReq = (headers: Record<string, string>, params: Record<string, string> = {}) => {
  return { headers, params } as Request;
};

const mockNext = jest.fn() as NextFunction;

// Sample payloads
const superAdminPayload: JwtPayload = { sub: 'sa1', email: 'super@admin.com', role: 'SUPER_ADMIN', type: 'SUPER_ADMIN' };
const storeAdminPayload: JwtPayload = { sub: 'u1', email: 'test@user.com', role: 'ADMIN', storeId: 'store123', type: 'USER' };

describe('Auth Middleware', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should call next() and attach user for a valid token', () => {
      const req = getMockReq({ authorization: 'Bearer validtoken' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);

      requireAuth(req, res, mockNext);

      expect(mockedJwt.verify).toHaveBeenCalledWith('validtoken', 'test-secret');
      expect(req.user).toEqual(storeAdminPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no authorization header is present', () => {
      const req = getMockReq({});
      const res = getMockRes();
      requireAuth(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for an invalid or expired token', () => {
      const req = getMockReq({ authorization: 'Bearer invalidtoken' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('should call next() if user is a super admin', () => {
      const req = getMockReq({ authorization: 'Bearer satoken' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(superAdminPayload);
      requireSuperAdmin(req, res, mockNext);
      expect(req.user).toEqual(superAdminPayload);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 if user is not a super admin', () => {
      const req = getMockReq({ authorization: 'Bearer usertoken' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);
      requireSuperAdmin(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireStoreAdmin', () => {
    it('should call next() for a store admin with matching storeId', () => {
      const req = getMockReq({ authorization: 'Bearer storetoken' }, { storeId: 'store123' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);
      requireStoreAdmin(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 for a store admin with mismatched storeId', () => {
      const req = getMockReq({ authorization: 'Bearer storetoken' }, { storeId: 'store456' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);
      requireStoreAdmin(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: store mismatch' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if the user is a super admin', () => {
      const req = getMockReq({ authorization: 'Bearer satoken' }, { storeId: 'store123' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(superAdminPayload);
      requireStoreAdmin(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Store admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdminOrSuperAdmin', () => {
    it('should call next() for a super admin', () => {
      const req = getMockReq({ authorization: 'Bearer satoken' }, { storeId: 'store123' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(superAdminPayload);
      requireAdminOrSuperAdmin(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() for a store admin with matching storeId', () => {
      const req = getMockReq({ authorization: 'Bearer storetoken' }, { storeId: 'store123' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);
      requireAdminOrSuperAdmin(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 for a store admin with mismatched storeId', () => {
      const req = getMockReq({ authorization: 'Bearer storetoken' }, { storeId: 'store456' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);
      requireAdminOrSuperAdmin(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should attach user and call next() for a valid token', () => {
      const req = getMockReq({ authorization: 'Bearer validtoken' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockReturnValue(storeAdminPayload);
      optionalAuth(req, res, mockNext);
      expect(req.user).toEqual(storeAdminPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() without a user for an invalid token', () => {
      const req = getMockReq({ authorization: 'Bearer invalidtoken' });
      const res = getMockRes();
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid');
      });
      optionalAuth(req, res, mockNext);
      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() without a user if no header is present', () => {
      const req = getMockReq({});
      const res = getMockRes();
      optionalAuth(req, res, mockNext);
      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});