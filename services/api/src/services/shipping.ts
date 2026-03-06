import { logger } from '../utils/logger';

export interface PackageDimensions {
    length: number; // cm
    width: number;  // cm
    height: number; // cm
    weight: number; // kg
}

export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

export interface ShippingRate {
    carrier: string;
    service: string;
    rate: number;
    currency: string;
    estimatedDays: number;
}

export interface ShippingRequest {
    origin: Address;
    destination: Address;
    packages: PackageDimensions[];
}

export interface ShippingCarrier {
    name: string;
    getRates(request: ShippingRequest): Promise<ShippingRate[]>;
}

/**
 * Volumetric (Dimensional) Weight Calculator
 * 
 * Formula: (L * W * H) / DimFactor
 * Standard DimFactor is 5000 for kg/cm³
 */
export class ShippingCalculator {
    static readonly DEFAULT_DIM_FACTOR = 5000;

    static calculateVolumetricWeight(dimensions: PackageDimensions, dimFactor: number = this.DEFAULT_DIM_FACTOR): number {
        const volume = dimensions.length * dimensions.width * dimensions.height;
        return parseFloat((volume / dimFactor).toFixed(2));
    }

    static getChargeableWeight(dimensions: PackageDimensions, dimFactor: number = this.DEFAULT_DIM_FACTOR): number {
        const volumetricWeight = this.calculateVolumetricWeight(dimensions, dimFactor);
        return Math.max(dimensions.weight, volumetricWeight);
    }
}

// ==================== MOCKED CARRIERS ====================

export class UPSMockCarrier implements ShippingCarrier {
    name = 'UPS';

    async getRates(request: ShippingRequest): Promise<ShippingRate[]> {
        logger.info('UPS: Sending mocked rate request');

        const totalWeight = request.packages.reduce((sum, pkg) => sum + ShippingCalculator.getChargeableWeight(pkg), 0);
        const baseRate = 12.00 + (totalWeight * 2.5);

        return [
            { carrier: 'UPS', service: 'Ground', rate: baseRate, currency: 'USD', estimatedDays: 5 },
            { carrier: 'UPS', service: '2nd Day Air', rate: baseRate * 2.1, currency: 'USD', estimatedDays: 2 },
            { carrier: 'UPS', service: 'Next Day Air', rate: baseRate * 4.5, currency: 'USD', estimatedDays: 1 }
        ];
    }
}

export class FedExMockCarrier implements ShippingCarrier {
    name = 'FedEx';

    async getRates(request: ShippingRequest): Promise<ShippingRate[]> {
        logger.info('FedEx: Sending mocked rate request');

        const totalWeight = request.packages.reduce((sum, pkg) => sum + ShippingCalculator.getChargeableWeight(pkg), 0);
        const baseRate = 14.50 + (totalWeight * 2.2);

        return [
            { carrier: 'FedEx', service: 'Home Delivery', rate: baseRate, currency: 'USD', estimatedDays: 4 },
            { carrier: 'FedEx', service: 'Express Saver', rate: baseRate * 1.8, currency: 'USD', estimatedDays: 3 },
            { carrier: 'FedEx', service: 'Overnight', rate: baseRate * 5.2, currency: 'USD', estimatedDays: 1 }
        ];
    }
}

export class USPSMockCarrier implements ShippingCarrier {
    name = 'USPS';

    async getRates(request: ShippingRequest): Promise<ShippingRate[]> {
        logger.info('USPS: Sending mocked rate request');

        const totalWeight = request.packages.reduce((sum, pkg) => sum + ShippingCalculator.getChargeableWeight(pkg), 0);
        const baseRate = 8.75 + (totalWeight * 3.1);

        return [
            { carrier: 'USPS', service: 'Priority Mail', rate: baseRate, currency: 'USD', estimatedDays: 3 },
            { carrier: 'USPS', service: 'Priority Mail Express', rate: baseRate * 3.8, currency: 'USD', estimatedDays: 1 },
            { carrier: 'USPS', service: 'First Class', rate: baseRate * 0.7, currency: 'USD', estimatedDays: 7 }
        ];
    }
}

// ==================== UNIFIED SHIPPING SERVICE ====================

export class ShippingService {
    private carriers: ShippingCarrier[];

    constructor() {
        this.carriers = [
            new UPSMockCarrier(),
            new FedExMockCarrier(),
            new USPSMockCarrier()
        ];
    }

    async getAllRates(request: ShippingRequest): Promise<ShippingRate[]> {
        try {
            const allRatePromises = this.carriers.map(carrier => carrier.getRates(request));
            const results = await Promise.all(allRatePromises);

            // Flatten and sort by price
            return results.flat().sort((a, b) => a.rate - b.rate);
        } catch (err) {
            logger.error('Failed to query shipping rates', { error: err });
            throw new Error('Shipping rate engine failed. Please try again later.');
        }
    }
}

export const shippingService = new ShippingService();
