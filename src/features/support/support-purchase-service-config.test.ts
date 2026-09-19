import { mockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import { getSupportPurchaseService } from '@/features/support/support-purchase-service-config.ios';

const mockAppleService = { loadProducts: jest.fn(), purchase: jest.fn() };

jest.mock('@/features/support/revenuecat-support-purchase-service.ios', () => ({
  createRevenueCatSupportPurchaseService: jest.fn(() => mockAppleService),
}));

describe('getSupportPurchaseService', () => {
  it('selects the mock service for mock mode', () => {
    expect(getSupportPurchaseService({ mode: 'mock' })).toBe(mockSupportPurchaseService);
  });

  it('selects the RevenueCat service for valid Apple configuration', () => {
    expect(getSupportPurchaseService({ apiKey: 'appl_public', mode: 'apple' })).toBe(
      mockAppleService,
    );
  });

  it('selects an unavailable service when Support is disabled', async () => {
    const service = getSupportPurchaseService({ mode: 'disabled' });

    await expect(service.loadProducts()).resolves.toEqual([]);
    await expect(service.purchase('small_tip')).rejects.toThrow(
      'Support purchases are not configured.',
    );
  });
});
