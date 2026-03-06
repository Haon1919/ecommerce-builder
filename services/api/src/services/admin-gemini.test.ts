import { processAdminChat } from './admin-gemini';
import { prisma } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Global mocks
jest.mock('../db', () => ({
    prisma: {
        store: { findUnique: jest.fn() },
        order: { aggregate: jest.fn(), findMany: jest.fn() },
        product: { findMany: jest.fn() },
    },
}));

jest.mock('../config', () => ({
    config: {
        gemini: {
            apiKey: 'test-api-key',
            model: 'gemini-1.5-pro',
        },
        logging: {
            level: 'info',
            structured: false
        }
    },
}));

let mockSendMessageLocal: jest.Mock;
let mockGetGenerativeModelLocal: jest.Mock;

jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: (...args: any[]) => mockGetGenerativeModelLocal(...args),
    })),
}));

describe('Admin Gemini Service', () => {
    const mockStoreId = 'store-123';

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default prisma mock returns
        (prisma.store.findUnique as jest.Mock).mockResolvedValue({
            id: mockStoreId,
            name: 'Test Store',
            settings: { currency: 'USD' },
        });
        (prisma.order.aggregate as jest.Mock).mockResolvedValue({
            _sum: { total: { toNumber: () => 1000.50 } },
        });
        (prisma.order.findMany as jest.Mock).mockResolvedValue([
            { orderNumber: 'ORD-1', status: 'COMPLETED', total: 100, currency: 'USD', createdAt: new Date() }
        ]);
        (prisma.product.findMany as jest.Mock).mockResolvedValue([
            { id: 'prod-1', name: 'Low Stock Item', stock: 2, price: 10, category: 'Widgets' }
        ]);

        mockSendMessageLocal = jest.fn().mockResolvedValue({
            response: { text: () => 'The store is doing well.' }
        });

        const mockStartChatLocal = jest.fn(() => ({ sendMessage: mockSendMessageLocal }));
        mockGetGenerativeModelLocal = jest.fn(() => ({ startChat: mockStartChatLocal }));
    });

    it('should process a chat message and return text without actions', async () => {
        const result = await processAdminChat(mockStoreId, 'How is my store doing?', []);

        expect(result).toEqual({
            text: 'The store is doing well.',
            action: null,
        });

        expect(prisma.store.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: mockStoreId } }));
        expect(mockGetGenerativeModelLocal).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gemini-1.5-pro',
            systemInstruction: expect.stringContaining('Test Store'),
        }));
        expect(mockSendMessageLocal).toHaveBeenCalledWith('How is my store doing?');
    });

    it('should parse an action block from the response', async () => {
        mockSendMessageLocal.mockResolvedValueOnce({
            response: { text: () => 'Navigating to products.\n```action\n{"type": "NAVIGATE", "path": "/products"}\n```' }
        });

        const result = await processAdminChat(mockStoreId, 'Go to my products', []);

        expect(result.text).toBe('Navigating to products.');
        expect(result.action).toEqual({ type: 'NAVIGATE', path: '/products' });
    });

    it('should handle invalid JSON in an action block gracefully', async () => {
        mockSendMessageLocal.mockResolvedValueOnce({
            response: { text: () => 'I made a mistake.\n```action\n{"type": "NAVIGATE", "path": "/invalid, }\n```' }
        });

        const result = await processAdminChat(mockStoreId, 'Bad action syntax', []);

        expect(result.text).toBe('I made a mistake.');
        expect(result.action).toBeNull();
    });

    it('should handle errors thrown during chat generation', async () => {
        (prisma.store.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

        const result = await processAdminChat(mockStoreId, 'Hello', []);

        expect(result.text).toBe("I'm sorry, I'm having trouble retrieving store data right now. Please try again later.");
        expect(result.action).toBeNull();
    });

    it('should allow overriding the Gemini API key', async () => {
        await processAdminChat(mockStoreId, 'Hello', [], 'custom-admin-key');

        expect(GoogleGenerativeAI).toHaveBeenCalledWith('custom-admin-key');
    });
});
