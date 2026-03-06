import { prisma } from '../db';

/**
 * Checks if a wildcard permission grants access to the requested action.
 * Examples: 
 *   hasPermissionMatch('*:*', 'products:read') -> true
 *   hasPermissionMatch('products:*', 'products:write') -> true
 *   hasPermissionMatch('products:*', 'orders:read') -> false
 *   hasPermissionMatch('products:read', 'products:read') -> true
 */
export function hasPermissionMatch(grantedAction: string, requestedAction: string): boolean {
    if (grantedAction === '*:*') return true;
    if (grantedAction === requestedAction) return true;

    const [grantedGroup, grantedSpecific] = grantedAction.split(':');
    const [requestedGroup, requestedSpecific] = requestedAction.split(':');

    if (grantedGroup === requestedGroup && grantedSpecific === '*') {
        return true;
    }

    return false;
}

/**
 * Asserts if a User ID currently possesses the requested action permission.
 */
export async function hasPermission(userId: string, requestedAction: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            role: {
                include: {
                    permissions: true,
                },
            },
        },
    });

    if (!user || !user.role) {
        return false;
    }

    return user.role.permissions.some((p) => hasPermissionMatch(p.action, requestedAction));
}

/**
 * Returns available system permissions mapping.
 */
export const AVAILABLE_PERMISSIONS = [
    '*:*',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'tickets:read',
    'tickets:write',
    'settings:read',
    'settings:write',
    'pages:read',
    'pages:write',
    'analytics:read',
    'logs:read',
    'vendors:read',
    'vendors:write',
    'b2b:read',
    'b2b:write',
];
