import { WebhookDispatcher, webhookDispatcher } from './webhook.dispatcher';
import { prisma } from '../db';
import crypto from 'crypto';
import { encrypt } from './encryption';

jest.mock('../db', () => ({
    prisma: {
        webhookSubscription: {
            findMany: jest.fn(),
        },
    },
}));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('WebhookDispatcher', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
    });

    afterEach(() => {
        // @ts-ignore
        delete global.fetch;
    });

    it('should dispatch webhooks to all subscribed targets with correct signature', async () => {
        const mockSecret = 'super-secret-key';
        const mockTargetUrl = 'https://example.com/webhook';

        (prisma.webhookSubscription.findMany as jest.Mock).mockResolvedValue([
            {
                id: 'sub-1',
                storeId: 'store-1',
                topic: 'product.created',
                targetUrl: mockTargetUrl,
                secret: encrypt(mockSecret),
                active: true,
            },
        ]);

        mockFetch.mockResolvedValue({ ok: true, status: 200 });

        const payload = { id: 'prod-1', name: 'Test Product' };

        webhookDispatcher.dispatch({
            topic: 'product.created',
            storeId: 'store-1',
            payload,
        });

        await new Promise(resolve => setImmediate(resolve));
        await new Promise(process.nextTick);

        expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith({
            where: {
                storeId: 'store-1',
                topic: 'product.created',
                active: true,
            },
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];

        expect(url).toBe(mockTargetUrl);
        expect(options.method).toBe('POST');
        expect(options.headers['X-Store-ID']).toBe('store-1');

        const expectedSignature = crypto
            .createHmac('sha256', mockSecret)
            .update(JSON.stringify(payload), 'utf8')
            .digest('hex');

        expect(options.headers['X-Webhook-Signature']).toBe(expectedSignature);
        expect(options.body).toBe(JSON.stringify(payload));

    });
});
