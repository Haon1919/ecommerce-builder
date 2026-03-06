import { prisma } from '../db';
import { encrypt, decrypt } from './encryption';
import crypto from 'crypto';

export interface OAuthTokenResponse {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scopes: string[];
}

export class OAuthService {
    /**
     * Generates a temporary authorization code.
     */
    static async generateAuthCode(params: {
        appId: string;
        storeId: string;
        userId: string;
        scopes: string[];
    }): Promise<string> {
        const code = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.oAuthCode.create({
            data: {
                code,
                appId: params.appId,
                storeId: params.storeId,
                userId: params.userId,
                scopes: params.scopes,
                expiresAt,
            },
        });

        return code;
    }

    /**
     * Exchanges an authorization code for access and refresh tokens.
     */
    static async exchangeCodeForToken(params: {
        clientId: string;
        clientSecret: string;
        code: string;
    }): Promise<OAuthTokenResponse> {
        const app = await prisma.externalApp.findUnique({
            where: { clientId: params.clientId },
        });

        if (!app) {
            throw new Error('Invalid client ID');
        }

        const decryptedSecret = decrypt(app.clientSecret);
        if (decryptedSecret !== params.clientSecret) {
            throw new Error('Invalid client secret');
        }

        const authCode = await prisma.oAuthCode.findUnique({
            where: { code: params.code },
        });

        if (!authCode || authCode.appId !== app.id || authCode.expiresAt < new Date()) {
            throw new Error('Invalid or expired authorization code');
        }

        const accessToken = crypto.randomBytes(48).toString('hex');
        const refreshToken = crypto.randomBytes(48).toString('hex');
        const expiresIn = 3600; // 1 hour
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // Encrypt tokens before storing
        const accessTokenEnc = encrypt(accessToken);
        const refreshTokenEnc = encrypt(refreshToken);

        await prisma.appInstallation.upsert({
            where: {
                storeId_appId: {
                    storeId: authCode.storeId,
                    appId: app.id,
                },
            },
            update: {
                accessTokenEnc,
                refreshTokenEnc,
                scopes: authCode.scopes,
                expiresAt,
            },
            create: {
                storeId: authCode.storeId,
                appId: app.id,
                accessTokenEnc,
                refreshTokenEnc,
                scopes: authCode.scopes,
                expiresAt,
            },
        });

        // Delete the used auth code
        await prisma.oAuthCode.delete({ where: { id: authCode.id } });

        return {
            accessToken,
            refreshToken,
            expiresIn,
            scopes: authCode.scopes,
        };
    }

    /**
     * Refreshes an access token using a refresh token.
     */
    static async refreshAccessToken(params: {
        clientId: string;
        clientSecret: string;
        refreshToken: string;
    }): Promise<OAuthTokenResponse> {
        const app = await prisma.externalApp.findUnique({
            where: { clientId: params.clientId },
        });

        if (!app) {
            throw new Error('Invalid client ID');
        }

        const decryptedSecret = decrypt(app.clientSecret);
        if (decryptedSecret !== params.clientSecret) {
            throw new Error('Invalid client secret');
        }

        // This is inefficient but necessary since refresh tokens are encrypted.
        // In a production app, we might store a hash of the refresh token for lookup.
        const installations = await prisma.appInstallation.findMany({
            where: { appId: app.id },
        });

        const installation = installations.find((inst) => inst.refreshTokenEnc && decrypt(inst.refreshTokenEnc) === params.refreshToken);

        if (!installation) {
            throw new Error('Invalid refresh token');
        }

        const newAccessToken = crypto.randomBytes(48).toString('hex');
        const newRefreshToken = crypto.randomBytes(48).toString('hex');
        const expiresIn = 3600;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        await prisma.appInstallation.update({
            where: { id: installation.id },
            data: {
                accessTokenEnc: encrypt(newAccessToken),
                refreshTokenEnc: encrypt(newRefreshToken),
                expiresAt,
            },
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn,
            scopes: installation.scopes,
        };
    }

    /**
     * Validates an access token and returns the installation context.
     */
    static async validateAccessToken(accessToken: string): Promise<{
        storeId: string;
        appId: string;
        scopes: string[];
    } | null> {
        // Again, inefficient lookup due to encryption.
        // Production alternative: Use a fast cache (Redis) or JWTs with store/app ID in payload.
        // For this implementation, we follow the "encrypt everything" requirement.
        const installations = await prisma.appInstallation.findMany({
            where: {
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        const installation = installations.find((inst) => decrypt(inst.accessTokenEnc) === accessToken);

        if (!installation) {
            return null;
        }

        return {
            storeId: installation.storeId,
            appId: installation.appId,
            scopes: installation.scopes,
        };
    }
}
