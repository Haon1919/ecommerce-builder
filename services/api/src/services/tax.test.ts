import { taxService } from './tax';
import { prisma } from '../db';
import { Address } from './shipping';

jest.mock('../db', () => ({
    prisma: {
        storeSettings: {
            findUnique: jest.fn(),
        },
    },
}));

describe('TaxService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 0 tax when store settings not configued', async () => {
        (prisma.storeSettings.findUnique as jest.Mock).mockResolvedValue(null);
        const result = await taxService.calculateTax('store-1', undefined, 100);
        expect(result.amount).toBe(0);
        expect(result.rate).toBe(0);
        expect(result.isNexus).toBe(false);
    });

    it('should calculate tax based on target address state if store has nexus', async () => {
        (prisma.storeSettings.findUnique as jest.Mock).mockResolvedValue({
            taxNexus: ['CA', 'NY'],
            taxRate: 10,
        });

        const address: Address = {
            line1: '123 Main St',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001',
            country: 'US',
        };

        const result = await taxService.calculateTax('store-1', address, 100);

        expect(result.isNexus).toBe(true);
        expect(result.rate).toBe(0.0725); // CA rate
        expect(result.amount).toBeCloseTo(7.25);
    });

    it('should return 0 tax if target state is not in taxNexus', async () => {
        (prisma.storeSettings.findUnique as jest.Mock).mockResolvedValue({
            taxNexus: ['CA', 'NY'],
            taxRate: 10,
        });

        const address: Address = {
            line1: '123 Main St',
            city: 'Seattle',
            state: 'WA', // No nexus
            zip: '98101',
            country: 'US',
        };

        const result = await taxService.calculateTax('store-1', address, 100);

        expect(result.isNexus).toBe(false);
        expect(result.rate).toBe(0);
        expect(result.amount).toBe(0);
    });

    it('should fallback to legacy tax rate if address is undefined but taxNexus is empty array', async () => {
        (prisma.storeSettings.findUnique as jest.Mock).mockResolvedValue({
            taxNexus: [],
            taxRate: 10,
        });

        const result = await taxService.calculateTax('store-1', undefined, 100);

        expect(result.isNexus).toBe(false);
        expect(result.rate).toBe(0.10);
        expect(result.amount).toBe(10);
    });
});
