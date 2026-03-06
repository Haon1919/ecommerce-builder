import { discountService, Cart } from './discount';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';

jest.mock('../db', () => ({
    prisma: {
        discountRule: {
            findMany: jest.fn(),
        },
    },
}));

const mockedPrisma = prisma as any;

describe('DiscountService', () => {
    const storeId = 'store-1';
    const cart: Cart = {
        items: [
            { productId: 'prod-1', quantity: 2, price: 50 },
            { productId: 'prod-2', quantity: 1, price: 100 }
        ],
        subtotal: 200
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should apply a percentage discount when conditions are met', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'rule-1',
                type: 'PERCENTAGE',
                value: new Prisma.Decimal(10),
                combinable: true,
                conditions: [
                    { type: 'MIN_CART_VALUE', value: '150' }
                ]
            }
        ]);

        const result = await discountService.calculateBestDiscounts(storeId, cart);
        expect(result).toHaveLength(1);
        expect(result[0].amount).toBe(20); // 10% of 200
    });

    it('should not apply discount if MIN_CART_VALUE is not met', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'rule-1',
                type: 'PERCENTAGE',
                value: new Prisma.Decimal(10),
                combinable: true,
                conditions: [
                    { type: 'MIN_CART_VALUE', value: '500' }
                ]
            }
        ]);

        const result = await discountService.calculateBestDiscounts(storeId, cart);
        expect(result).toHaveLength(0);
    });

    it('should apply discount only to users with specific tags', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'rule-vip',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(50),
                combinable: true,
                conditions: [
                    { type: 'CUSTOMER_TAG', value: 'VIP' }
                ]
            }
        ]);

        const noVipResult = await discountService.calculateBestDiscounts(storeId, cart, ['NORMAL']);
        expect(noVipResult).toHaveLength(0);

        const vipResult = await discountService.calculateBestDiscounts(storeId, cart, ['VIP']);
        expect(vipResult).toHaveLength(1);
        expect(vipResult[0].amount).toBe(50);
    });

    it('should handle Buy 1 Get 1 Free on the same product', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'bogo',
                type: 'BUY_X_GET_Y',
                buyQuantity: 1,
                getQuantity: 1,
                buyProductId: 'prod-1',
                getProductId: 'prod-1',
                combinable: true,
                conditions: []
            }
        ]);

        // cart has 2 of prod-1. In BOGO (buy 1, get 1), 1 should be free.
        const result = await discountService.calculateBestDiscounts(storeId, cart);
        expect(result[0].amount).toBe(50);
    });

    it('should pick the best non-combinable rule over the sum of combinables', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'comb-1',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(10),
                combinable: true,
                conditions: []
            },
            {
                id: 'comb-2',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(15),
                combinable: true,
                conditions: []
            },
            {
                id: 'noncomb-1',
                type: 'PERCENTAGE',
                value: new Prisma.Decimal(20), // 20% of 200 = 40
                combinable: false,
                conditions: []
            }
        ]);

        // Sum of combinable = 25. Non-combinable = 40. Pick 40.
        const result = await discountService.calculateBestDiscounts(storeId, cart);
        expect(result).toHaveLength(1);
        expect(result[0].ruleId).toBe('noncomb-1');
        expect(result[0].amount).toBe(40);
    });

    it('should stack combinable rules if their sum is better than any non-combinable', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'comb-1',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(30),
                combinable: true,
                conditions: []
            },
            {
                id: 'comb-2',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(20),
                combinable: true,
                conditions: []
            },
            {
                id: 'noncomb-1',
                type: 'PERCENTAGE',
                value: new Prisma.Decimal(10), // 10% of 200 = 20
                combinable: false,
                conditions: []
            }
        ]);

        // Sum of combinable = 50. Non-combinable = 20. Pick 50.
        const result = await discountService.calculateBestDiscounts(storeId, cart);
        expect(result).toHaveLength(2);
        const total = result.reduce((sum, r) => sum + r.amount, 0);
        expect(total).toBe(50);
    });

    it('should pick from multiple non-combinable rules correctly', async () => {
        mockedPrisma.discountRule.findMany.mockResolvedValue([
            {
                id: 'noncomb-small',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(10),
                combinable: false,
                conditions: []
            },
            {
                id: 'noncomb-large',
                type: 'FIXED_AMOUNT',
                value: new Prisma.Decimal(100),
                combinable: false,
                conditions: []
            }
        ]);

        const result = await discountService.calculateBestDiscounts(storeId, cart);
        expect(result).toHaveLength(1);
        expect(result[0].ruleId).toBe('noncomb-large');
        expect(result[0].amount).toBe(100);
    });
});
