import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requirePermission } from '../middleware/auth.permission';
import { AVAILABLE_PERMISSIONS } from '../services/roles.service';

const router = Router();

const roleSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()),
});

// GET /stores/:storeId/roles - list all roles
router.get('/:storeId/roles', requirePermission('settings:read'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;

    const roles = await prisma.role.findMany({
        where: { storeId },
        include: {
            permissions: true,
            _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    res.json(roles);
});

// POST /stores/:storeId/roles - create a role
router.post('/:storeId/roles', requirePermission('settings:write'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const { name, description, permissions } = parsed.data;

    // Validate permissions against available system permissions
    const invalidPermissions = permissions.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
        res.status(400).json({ error: 'Invalid permissions', details: invalidPermissions });
        return;
    }

    const role = await prisma.role.create({
        data: {
            storeId,
            name,
            description,
            permissions: {
                create: permissions.map(action => ({ action })),
            },
        },
        include: { permissions: true },
    });

    res.status(201).json(role);
});

// PUT /stores/:storeId/roles/:roleId - update a role
router.put('/:storeId/roles/:roleId', requirePermission('settings:write'), async (req: Request, res: Response): Promise<void> => {
    const { storeId, roleId } = req.params as { storeId: string; roleId: string };
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const { name, description, permissions } = parsed.data;

    const existingRole = await prisma.role.findUnique({
        where: { id: roleId, storeId },
    });

    if (!existingRole) {
        res.status(404).json({ error: 'Role not found' });
        return;
    }

    if (existingRole.isStatic) {
        res.status(403).json({ error: 'Static roles cannot be modified' });
        return;
    }

    // Validate permissions
    const invalidPermissions = permissions.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
        res.status(400).json({ error: 'Invalid permissions', details: invalidPermissions });
        return;
    }

    const role = await prisma.$transaction(async (tx) => {
        // Delete existing permissions
        await tx.permission.deleteMany({ where: { roleId } });

        // Update role and create new permissions
        return await tx.role.update({
            where: { id: roleId },
            data: {
                name,
                description,
                permissions: {
                    create: permissions.map(action => ({ action })),
                },
            },
            include: { permissions: true },
        });
    });

    res.json(role);
});

// DELETE /stores/:storeId/roles/:roleId
router.delete('/:storeId/roles/:roleId', requirePermission('settings:write'), async (req: Request, res: Response): Promise<void> => {
    const { storeId, roleId } = req.params as { storeId: string; roleId: string };

    const role = await prisma.role.findUnique({
        where: { id: roleId, storeId },
        include: { _count: { select: { users: true } } },
    });

    if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
    }

    if (role.isStatic) {
        res.status(403).json({ error: 'Static roles cannot be deleted' });
        return;
    }

    if (role._count.users > 0) {
        res.status(422).json({ error: 'Cannot delete role assigned to users. Reassign users first.' });
        return;
    }

    await prisma.role.delete({ where: { id: roleId } });
    res.json({ success: true });
});

// GET /stores/:storeId/staff - list all staff members
router.get('/:storeId/staff', requirePermission('settings:read'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;

    const staff = await prisma.user.findMany({
        where: { storeId },
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            lastLoginAt: true,
            role: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    res.json(staff);
});

// PATCH /stores/:storeId/staff/:userId/role - change a staff member's role
router.patch('/:storeId/staff/:userId/role', requirePermission('settings:write'), async (req: Request, res: Response): Promise<void> => {
    const { storeId, userId } = req.params as { storeId: string; userId: string };
    const { roleId } = req.body as { roleId: string };

    if (!roleId) {
        res.status(400).json({ error: 'RoleId is required' });
        return;
    }

    const [user, role] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId, storeId } }),
        prisma.role.findUnique({ where: { id: roleId, storeId } }),
    ]);

    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }

    if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { roleId },
        select: {
            id: true,
            email: true,
            name: true,
            role: {
                select: { id: true, name: true },
            },
        },
    });

    res.json(updatedUser);
});

// GET /roles/permissions - available permissions
router.get('/permissions', requirePermission('settings:read'), async (_req: Request, res: Response): Promise<void> => {
    res.json(AVAILABLE_PERMISSIONS);
});

export default router;
