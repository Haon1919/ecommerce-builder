import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from './auth';
import { hasPermission } from '../services/roles.service';
import { logger } from '../utils/logger';

/**
 * Require a specific granular permission for the given route.
 * Also enforces storeId isolation.
 */
export function requirePermission(action: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // 1. Ensure authenticated (re-verify if requireAuth was NOT called before, or just check req.user)
        if (!req.user) {
            const header = req.headers.authorization;
            if (!header?.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            try {
                req.user = verifyToken(header.slice(7));
            } catch {
                res.status(401).json({ error: 'Invalid or expired token' });
                return;
            }
        }

        const user = req.user as JwtPayload;
        if (!user) return;

        // 2. Super admins bypass store-level permissions for simplicity
        if (user.type === 'SUPER_ADMIN') {
            next();
            return;
        }

        // 3. Multi-tenant isolation: check storeId
        const requestStoreId = req.params.storeId || (req as Request & { storeId?: string }).storeId;
        if (requestStoreId && requestStoreId !== user.storeId) {
            res.status(403).json({ error: 'Access denied: store mismatch' });
            return;
        }

        // 4. Granular RBAC evaluation
        try {
            const allowed = await hasPermission(user.sub, action);
            if (!allowed) {
                res.status(403).json({ error: 'Forbidden: Missing required permission' });
                return;
            }
            next();
        } catch (err) {
            logger.error('Permission check error', { error: err });
            res.status(500).json({ error: 'Internal server error during permission evaluation' });
        }
    };
}
