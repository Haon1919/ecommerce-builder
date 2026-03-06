import { PaymentService } from './payment';
import { logger } from '../utils/logger';

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('PaymentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processSplitPayout', () => {
        it('should process split payouts correctly', async () => {
            const items = [
                { vendorStripeAccountId: 'acct_1', amount: 1000, currency: 'usd' },
                { vendorStripeAccountId: 'acct_2', amount: 500 },
            ];

            const result = await PaymentService.processSplitPayout(items);

            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('Processing split payout via Stripe Connect', { items });
            expect(logger.info).toHaveBeenCalledWith('Transferred 1000 to account acct_1');
            expect(logger.info).toHaveBeenCalledWith('Transferred 500 to account acct_2');
        });

        it('should handle empty items array', async () => {
            const result = await PaymentService.processSplitPayout([]);

            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('Processing split payout via Stripe Connect', { items: [] });
            expect(logger.info).toHaveBeenCalledTimes(1); // Only the initial info log
        });
    });
});
