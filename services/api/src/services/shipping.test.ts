import { ShippingCalculator, UPSMockCarrier, FedExMockCarrier, USPSMockCarrier, ShippingService, ShippingRequest, PackageDimensions } from './shipping';

describe('ShippingCalculator', () => {

    it('should correctly calculate volumetric weight with default dim factor (5000)', () => {
        const pkg: PackageDimensions = { length: 50, width: 40, height: 30, weight: 10 };
        // (50 * 40 * 30) / 5000 = 60000 / 5000 = 12
        const volumetricWeight = ShippingCalculator.calculateVolumetricWeight(pkg);
        expect(volumetricWeight).toBe(12);
    });

    it('should correctly calculate volumetric weight with custom dim factor (139)', () => {
        const pkg: PackageDimensions = { length: 10, width: 8, height: 6, weight: 2 };
        // (10 * 8 * 6) / 139 = 480 / 139 = 3.453...
        const volumetricWeight = ShippingCalculator.calculateVolumetricWeight(pkg, 139);
        expect(volumetricWeight).toBe(3.45);
    });

    it('should return the higher of weight and volumetric weight as chargeable weight', () => {
        const pkg1: PackageDimensions = { length: 20, width: 20, height: 20, weight: 10 };
        // vol = (20^3)/5000 = 8000/5000 = 1.6
        // chargeable = max(10, 1.6) = 10
        expect(ShippingCalculator.getChargeableWeight(pkg1)).toBe(10);

        const pkg2: PackageDimensions = { length: 60, width: 60, height: 60, weight: 5 };
        // vol = (60^3)/5000 = 216000 / 5000 = 43.2
        // chargeable = max(5, 43.2) = 43.2
        expect(ShippingCalculator.getChargeableWeight(pkg2)).toBe(43.2);
    });

});

describe('Carrier Mock Integrations', () => {

    const mockRequest: ShippingRequest = {
        origin: { line1: '123 Pine St', city: 'Seattle', state: 'WA', zip: '98101', country: 'US' },
        destination: { line1: '456 Oak St', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
        packages: [{ length: 12, width: 12, height: 12, weight: 5 }]
    };

    test('UPSMockCarrier should return rates', async () => {
        const carrier = new UPSMockCarrier();
        const rates = await carrier.getRates(mockRequest);

        expect(rates.length).toBeGreaterThan(0);
        expect(rates[0]).toMatchObject({
            carrier: 'UPS',
            service: expect.any(String),
            rate: expect.any(Number),
            currency: 'USD'
        });
    });

    test('FedExMockCarrier should return rates', async () => {
        const carrier = new FedExMockCarrier();
        const rates = await carrier.getRates(mockRequest);

        expect(rates.length).toBeGreaterThan(0);
        expect(rates[0].carrier).toBe('FedEx');
    });

    test('USPSMockCarrier should return rates', async () => {
        const carrier = new USPSMockCarrier();
        const rates = await carrier.getRates(mockRequest);

        expect(rates.length).toBeGreaterThan(0);
        expect(rates[0].carrier).toBe('USPS');
    });

});

describe('ShippingService (Unified)', () => {

    const mockRequest: ShippingRequest = {
        origin: { line1: '123 Pine St', city: 'Seattle', state: 'WA', zip: '98101', country: 'US' },
        destination: { line1: '456 Oak St', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
        packages: [{ length: 12, width: 12, height: 12, weight: 5 }]
    };

    test('getAllRates should aggregate and sort rates from all carriers', async () => {
        const service = new ShippingService();
        const allRates = await service.getAllRates(mockRequest);

        // 3 each * 3 carriers = 9
        expect(allRates.length).toBe(9);

        // Should be sorted by price ascending
        for (let i = 0; i < allRates.length - 1; i++) {
            expect(allRates[i].rate).toBeLessThanOrEqual(allRates[i + 1].rate);
        }
    });

});
