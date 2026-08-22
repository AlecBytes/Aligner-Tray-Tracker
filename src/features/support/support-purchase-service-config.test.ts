import { mockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import { getSupportPurchaseService } from '@/features/support/support-purchase-service-config';

describe('getSupportPurchaseService', () => {
  it('selects the mock service for mock mode', () => {
    expect(getSupportPurchaseService('mock')).toBe(mockSupportPurchaseService);
  });

  it('selects an unavailable service when Support is disabled', async () => {
    const service = getSupportPurchaseService('disabled');

    await expect(service.loadProducts()).resolves.toEqual([]);
    await expect(service.purchase('small_tip')).rejects.toThrow(
      'Support purchases are not configured.',
    );
  });
});
