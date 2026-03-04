import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import { logger } from '../utils/logger';

export interface JwtPayload {
  sub: string;           // user id or super admin id
  email: string;
  role: string;          // UserRole or 'SUPER_ADMIN'
  storeId?: string;      // undefined for super admins
  type: 'USER' | 'SUPER_ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

/**
 * Authenticate any valid JWT (user or super admin).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require super admin access.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.type !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  });
}

/**
 * Require store admin access. Also checks that the storeId in the request
 * matches the token's storeId (multi-tenant isolation).
 */
export function requireStoreAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const user = req.user;
    if (!user || user.type !== 'USER') {
      res.status(403).json({ error: 'Store admin access required' });
      return;
    }

    // storeId isolation: param OR body storeId must match token
    const requestStoreId = req.params.storeId || (req as Request & { storeId?: string }).storeId;
    if (requestStoreId && requestStoreId !== user.storeId) {
      res.status(403).json({ error: 'Access denied: store mismatch' });
      return;
    }

    next();
  });
}

/**
 * Allow either store admin (for their own store) or super admin.
 * When a super admin accesses a store-scoped route this is explicitly
 * audit-logged so every cross-tenant action is traceable.
 */
export function requireAdminOrSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (user.type === 'SUPER_ADMIN') {
      // Audit log every super admin access to a store-scoped resource
      const storeId = (Array.isArray(req.params.storeId) ? req.params.storeId[0] : req.params.storeId) ?? null;
      logger.warn('Super admin accessed store-scoped route', {
        adminId: user.sub,
        storeId,
        method: req.method,
        path: req.path,
      });
      prisma.appLog
        .create({
          data: {
            storeId,
            level: 'WARN',
            service: 'api',
            message: `Super admin ${user.sub} accessed store-scoped route ${req.method} ${req.path}`,
            meta: { adminId: user.sub, method: req.method, path: req.path },
          },
        })
        .catch(() => {});
      next();
      return;
    }

    const requestStoreId = req.params.storeId;
    if (requestStoreId && requestStoreId !== user.storeId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  });
}

/**
 * Optional auth — attaches user if token present, continues regardless.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}
