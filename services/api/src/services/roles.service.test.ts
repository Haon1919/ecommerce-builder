import { hasPermissionMatch, hasPermission } from './roles.service';
import { prisma } from '../db';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../db', () => ({
    prisma: require('jest-mock-extended').mockDeep(),
}));

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Roles Service - hasPermissionMatch', () => {
    it('should return true for identical actions', () => {
        expect(hasPermissionMatch('products:read', 'products:read')).toBe(true);
    });

    it('should return false for completely different actions', () => {
        expect(hasPermissionMatch('products:read', 'orders:read')).toBe(false);
    });

    it('should handle global wildcard', () => {
        expect(hasPermissionMatch('*:*', 'products:write')).toBe(true);
        expect(hasPermissionMatch('*:*', 'settings:read')).toBe(true);
    });

    it('should handle group wildcard', () => {
        expect(hasPermissionMatch('products:*', 'products:read')).toBe(true);
        expect(hasPermissionMatch('products:*', 'products:write')).toBe(true);
        expect(hasPermissionMatch('products:*', 'orders:read')).toBe(false);
    });

    it('should not allow specific action to grant group wildcard', () => {
        expect(hasPermissionMatch('products:read', 'products:*')).toBe(false);
    });
});

describe('Roles Service - hasPermission (DB Integrated)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return true if user role has the required permission', async () => {
        const mockUser = {
            id: 'user-1',
            role: {
                permissions: [
                    { action: 'products:read' },
                    { action: 'orders:*' },
                ]
            }
        };
        mockedPrisma.user.findUnique.mockResolvedValue(mockUser as any);

        expect(await hasPermission('user-1', 'products:read')).toBe(true);
        expect(await hasPermission('user-1', 'orders:write')).toBe(true);
    });

    it('should return false if user role does not have the permission', async () => {
        const mockUser = {
            id: 'user-1',
            role: {
                permissions: [
                    { action: 'products:read' },
                ]
            }
        };
        mockedPrisma.user.findUnique.mockResolvedValue(mockUser as any);

        expect(await hasPermission('user-1', 'orders:read')).toBe(false);
    });

    it('should return false if user or role not found', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(null);
        expect(await hasPermission('non-existent', 'products:read')).toBe(false);
    });
});
