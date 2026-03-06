import { OAuthService } from './oauth.service';
import { prisma } from '../db';
import { encrypt, decrypt } from './encryption';

jest.mock('../db', () => ({
    prisma: {
        externalApp: {
            findUnique: jest.fn(),
        },
        oAuthCode: {
            create: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
        },
        appInstallation: {
            upsert: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock('./encryption', () => ({
    encrypt: jest.fn((val) => `enc:${val}`),
    decrypt: jest.fn((val) => val.replace('enc:', '')),
}));

describe('OAuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateAuthCode', () => {
        it('should create an auth code in the database', async () => {
            const params = {
                appId: 'app-1',
                storeId: 'store-1',
                userId: 'user-1',
                scopes: ['read_products'],
            };

            const code = await OAuthService.generateAuthCode(params);

            expect(code).toBeDefined();
            expect(typeof code).toBe('string');
            expect(prisma.oAuthCode.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    appId: params.appId,
                    storeId: params.storeId,
                    userId: params.userId,
                    scopes: params.scopes,
                    expiresAt: expect.any(Date),
                }),
            });
        });
    });

    describe('exchangeCodeForToken', () => {
        const mockApp = {
            id: 'app-1',
            clientId: 'client-1',
            clientSecret: 'enc:secret-1',
        };
        const mockCode = {
            id: 'code-1',
            code: 'valid-code',
            appId: 'app-1',
            storeId: 'store-1',
            scopes: ['read_products'],
            expiresAt: new Date(Date.now() + 10000),
        };

        it('should exchange a valid code for tokens', async () => {
            (prisma.externalApp.findUnique as jest.Mock).mockResolvedValue(mockApp);
            (prisma.oAuthCode.findUnique as jest.Mock).mockResolvedValue(mockCode);

            const result = await OAuthService.exchangeCodeForToken({
                clientId: 'client-1',
                clientSecret: 'secret-1',
                code: 'valid-code',
            });

            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.scopes).toEqual(['read_products']);
            expect(prisma.appInstallation.upsert).toHaveBeenCalled();
            expect(prisma.oAuthCode.delete).toHaveBeenCalledWith({ where: { id: 'code-1' } });
        });

        it('should throw error for invalid client secret', async () => {
            (prisma.externalApp.findUnique as jest.Mock).mockResolvedValue(mockApp);

            await expect(
                OAuthService.exchangeCodeForToken({
                    clientId: 'client-1',
                    clientSecret: 'wrong-secret',
                    code: 'valid-code',
                })
            ).rejects.toThrow('Invalid client secret');
        });

        it('should throw error for expired code', async () => {
            (prisma.externalApp.findUnique as jest.Mock).mockResolvedValue(mockApp);
            (prisma.oAuthCode.findUnique as jest.Mock).mockResolvedValue({
                ...mockCode,
                expiresAt: new Date(Date.now() - 10000),
            });

            await expect(
                OAuthService.exchangeCodeForToken({
                    clientId: 'client-1',
                    clientSecret: 'secret-1',
                    code: 'valid-code',
                })
            ).rejects.toThrow('Invalid or expired authorization code');
        });
    });

    describe('refreshAccessToken', () => {
        const mockApp = { id: 'app-1', clientId: 'client-1', clientSecret: 'enc:secret-1' };
        const mockInstallation = {
            id: 'inst-1',
            appId: 'app-1',
            refreshTokenEnc: 'enc:refresh-1',
            scopes: ['read_products'],
        };

        it('should refresh token with a valid refresh token', async () => {
            (prisma.externalApp.findUnique as jest.Mock).mockResolvedValue(mockApp);
            (prisma.appInstallation.findMany as jest.Mock).mockResolvedValue([mockInstallation]);

            const result = await OAuthService.refreshAccessToken({
                clientId: 'client-1',
                clientSecret: 'secret-1',
                refreshToken: 'refresh-1',
            });

            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(prisma.appInstallation.update).toHaveBeenCalled();
        });

        it('should throw error for invalid refresh token', async () => {
            (prisma.externalApp.findUnique as jest.Mock).mockResolvedValue(mockApp);
            (prisma.appInstallation.findMany as jest.Mock).mockResolvedValue([mockInstallation]);

            await expect(
                OAuthService.refreshAccessToken({
                    clientId: 'client-1',
                    clientSecret: 'secret-1',
                    refreshToken: 'wrong-refresh',
                })
            ).rejects.toThrow('Invalid refresh token');
        });
    });

    describe('validateAccessToken', () => {
        it('should return context for a valid access token', async () => {
            const mockInstallation = {
                storeId: 'store-1',
                appId: 'app-1',
                accessTokenEnc: 'enc:access-1',
                scopes: ['read_products'],
                expiresAt: new Date(Date.now() + 10000),
            };
            (prisma.appInstallation.findMany as jest.Mock).mockResolvedValue([mockInstallation]);

            const result = await OAuthService.validateAccessToken('access-1');

            expect(result).toEqual({
                storeId: 'store-1',
                appId: 'app-1',
                scopes: ['read_products'],
            });
        });

        it('should return null for invalid access token', async () => {
            (prisma.appInstallation.findMany as jest.Mock).mockResolvedValue([]);

            const result = await OAuthService.validateAccessToken('invalid-access');

            expect(result).toBeNull();
        });
    });
});
