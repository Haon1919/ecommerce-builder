import { processChat, getEventRecommendations } from './gemini';
import { prisma } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Global mocks
jest.mock('../db', () => ({
    prisma: {
        store: { findUnique: jest.fn() },
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
let mockGenerateContentLocal: jest.Mock;
let mockGetGenerativeModelLocal: jest.Mock;

jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: (...args: any[]) => mockGetGenerativeModelLocal(...args),
    })),
}));

describe('Gemini Service', () => {
    const mockStoreId = 'store-123';

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default prisma mock returns
        (prisma.store.findUnique as jest.Mock).mockResolvedValue({
            id: mockStoreId,
            name: 'Test Store',
            description: 'A great place',
            settings: {
                currency: 'USD',
                shippingPolicy: 'Ships fast',
                returnPolicy: '30 days',
                contactEmail: 'contact@store.com'
            },
        });

        (prisma.product.findMany as jest.Mock).mockResolvedValue([
            { id: 'prod-1', name: 'Widget A', description: 'Nice widget', price: 10, stock: 5, category: 'Widgets', tags: ['cool'] },
            { id: 'prod-2', name: 'Widget B', description: 'Another widget', price: 20, stock: 0, category: 'Widgets', tags: ['rad'] }
        ]);

        mockSendMessageLocal = jest.fn().mockResolvedValue({
            response: { text: () => 'A friendly response' }
        });

        mockGenerateContentLocal = jest.fn().mockResolvedValue({
            response: { text: () => '{"products": [{"id": "prod-1", "name": "Widget A", "reason": "Because"}], "summary": "Great choice"}' }
        });

        const mockStartChatLocal = jest.fn(() => ({ sendMessage: mockSendMessageLocal }));
        mockGetGenerativeModelLocal = jest.fn(() => ({
            startChat: mockStartChatLocal,
            generateContent: mockGenerateContentLocal
        }));
    });

    describe('processChat', () => {
        it('should process a chat message and return clean text', async () => {
            const result = await processChat(mockStoreId, 'Hello', []);

            expect(result).toEqual({
                text: 'A friendly response',
                action: null,
            });

            expect(prisma.store.findUnique).toHaveBeenCalled();
            expect(prisma.product.findMany).toHaveBeenCalled();
            expect(mockSendMessageLocal).toHaveBeenCalledWith(['Hello']);
        });

        it('should parse an action block from the response', async () => {
            mockSendMessageLocal.mockResolvedValueOnce({
                response: { text: () => 'Here are products.\n```action\n{"type": "SHOW_PRODUCTS", "productIds": ["prod-1"]}\n```' }
            });

            const result = await processChat(mockStoreId, 'Show products', []);

            expect(result.text).toBe('Here are products.');
            expect(result.action).toEqual({ type: 'SHOW_PRODUCTS', productIds: ['prod-1'] });
        });

        it('should handle invalid JSON in an action block gracefully', async () => {
            mockSendMessageLocal.mockResolvedValueOnce({
                response: { text: () => 'Oops.\n```action\n{"type": "SHOW_PRODUCTS", }\n```' }
            });

            const result = await processChat(mockStoreId, 'Bad syntax', []);

            expect(result.text).toBe('Oops.');
            expect(result.action).toBeNull();
        });

        it('should handle errors gracefully returning a fallback message', async () => {
            const errorStoreId = 'store-error-123';
            (prisma.store.findUnique as jest.Mock).mockRejectedValueOnce(new Error('DB connection failed'));

            const result = await processChat(errorStoreId, 'Hello?', []);

            expect(result.text).toBe("I'm sorry, I'm having trouble connecting right now. Please try again in a moment or contact our support team.");
            expect(result.action).toBeNull();
        });

        it('should process an audio payload correctly', async () => {
            const result = await processChat(mockStoreId, '', [], undefined, { data: 'base64audio', mimeType: 'audio/mp3' });

            expect(mockSendMessageLocal).toHaveBeenCalledWith([
                "Please listen to this audio message from the user and respond accordingly as the shopping assistant.",
                { inlineData: { data: 'base64audio', mimeType: 'audio/mp3' } }
            ]);
            expect(result.text).toBe('A friendly response');
        });

        it('should use a custom API key if provided', async () => {
            const result = await processChat(mockStoreId, 'Hello', [], 'custom-store-key');
            expect(result.text).toBe('A friendly response');
            expect(GoogleGenerativeAI).toHaveBeenCalledWith('custom-store-key');
        });
    });

    describe('getEventRecommendations', () => {
        it('should generate valid recommendations JSON', async () => {
            const result = await getEventRecommendations(mockStoreId, 'Birthday Party', 50);

            expect(result).toEqual({
                products: [{ id: 'prod-1', name: 'Widget A', reason: 'Because' }],
                summary: 'Great choice'
            });

            expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { storeId: mockStoreId, active: true, stock: { gt: 0 } }
            }));
            expect(mockGenerateContentLocal).toHaveBeenCalled();
        });

        it('should handle invalid JSON from model', async () => {
            mockGenerateContentLocal.mockResolvedValueOnce({
                response: { text: () => 'Here are recommendations: No JSON block here.' }
            });

            const result = await getEventRecommendations(mockStoreId, 'Wedding');

            expect(result).toEqual({
                products: [],
                summary: "I couldn't generate recommendations. Please browse our products directly.",
            });
        });

        it('should handle model errors gracefully', async () => {
            mockGenerateContentLocal.mockRejectedValueOnce(new Error('API error'));

            const result = await getEventRecommendations(mockStoreId, 'Party');

            expect(result).toEqual({
                products: [],
                summary: "I couldn't generate recommendations. Please browse our products directly.",
            });
        });
    });

    describe('generateStoreLayout', () => {
        const { generateStoreLayout } = require('./gemini');

        it('should generate a valid JSON layout', async () => {
            mockGenerateContentLocal.mockResolvedValueOnce({
                response: { text: () => '```json\n[\n  {"id": "hero-1", "type": "HeroSection", "order": 0, "props": {"title": "Welcome"}}\n]\n```' }
            });

            const result = await generateStoreLayout(mockStoreId, 'Make it modern');

            expect(result).toEqual([
                { id: 'hero-1', type: 'HeroSection', order: 0, props: { title: 'Welcome' } }
            ]);
            expect(mockGenerateContentLocal).toHaveBeenCalled();
            expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: mockStoreId } });
        });

        it('should handle naked JSON arrays without markdown blocks', async () => {
            mockGenerateContentLocal.mockResolvedValueOnce({
                response: { text: () => '[\n  {"id": "hero-1", "type": "HeroSection", "order": 0, "props": {"title": "Welcome"}}\n]' }
            });

            const result = await generateStoreLayout(mockStoreId);

            expect(result).toEqual([
                { id: 'hero-1', type: 'HeroSection', order: 0, props: { title: 'Welcome' } }
            ]);
        });

        it('should extract JSON if the model returns extra text', async () => {
            mockGenerateContentLocal.mockResolvedValueOnce({
                response: { text: () => 'Here is your layout:\n[\n  {"id": "hero-1", "type": "HeroSection"}\n]\nEnjoy!' }
            });

            const result = await generateStoreLayout(mockStoreId);

            expect(result).toEqual([
                { id: 'hero-1', type: 'HeroSection' }
            ]);
        });

        it('should throw an error if store is not found', async () => {
            (prisma.store.findUnique as jest.Mock).mockResolvedValueOnce(null);

            await expect(generateStoreLayout('unknown-store')).rejects.toThrow('Store not found');
        });

        it('should throw an error if model fails or returns invalid JSON', async () => {
            mockGenerateContentLocal.mockResolvedValueOnce({
                response: { text: () => 'Not a JSON block' }
            });

            await expect(generateStoreLayout(mockStoreId)).rejects.toThrow('Failed to generate layout');
        });
    });
});
