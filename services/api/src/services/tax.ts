import { Address } from './shipping';
import { prisma } from '../db';
import { logger } from '../utils/logger';

export interface TaxRateResult {
    rate: number;      // e.g. 0.0825
    amount: number;    // Calculated tax amount
    isNexus: boolean;  // Did it match a store nexus jurisdiction?
}

export class TaxService {
    // Mocked state/regional base tax rates (in reality, depends on city/county via Avalara)
    private readonly mockStateRates: Record<string, number> = {
        'CA': 0.0725,
        'NY': 0.04,
        'WA': 0.065,
        'TX': 0.0625,
        'FL': 0.06,
        'UK': 0.20, // VAT example
    };

    /**
     * Calculates tax based on the destination address and taxable amount.
     * Takes into account the store's configured physical presence (Nexus).
     */
    async calculateTax(storeId: string, address: Address | undefined, taxableSubtotal: number): Promise<TaxRateResult> {
        try {
            const settings = await prisma.storeSettings.findUnique({
                where: { storeId }
            });

            if (!settings) {
                return { rate: 0, amount: 0, isNexus: false };
            }

            // If no address provided (like in early cart stages), fallback to legacy or default
            if (!address || !address.state) {
                const legacyRate = (settings.taxRate || 0) / 100;
                return {
                    rate: legacyRate,
                    amount: taxableSubtotal * legacyRate,
                    isNexus: false
                };
            }

            const stateCode = address.state.toUpperCase();

            // Check if store has configured a tax nexus in this state/jurisdiction
            const hasNexus = settings.taxNexus.includes(stateCode);

            if (!hasNexus) {
                // If taxNexus array is completely empty, use backwards-compatible legacy tax rate
                if (settings.taxNexus.length === 0) {
                    const legacyRate = (settings.taxRate || 0) / 100;
                    return {
                        rate: legacyRate,
                        amount: taxableSubtotal * legacyRate,
                        isNexus: false
                    };
                }

                // Active nexus management but no nexus in target state = $0 tax.
                return { rate: 0, amount: 0, isNexus: false };
            }

            // Call to external Tax provider (TaxJar/Avalara) happens here.
            // For now, use the mock table or default 5%.
            const rate = this.mockStateRates[stateCode] || 0.05;

            return {
                rate,
                amount: taxableSubtotal * rate,
                isNexus: true
            };

        } catch (error) {
            logger.error(`Error calculating dynamic tax for store ${storeId}`, { error });
            return { rate: 0, amount: 0, isNexus: false };
        }
    }
}

export const taxService = new TaxService();
