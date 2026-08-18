import { createMockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import { MOCK_SUPPORT_PRODUCTS } from '@/features/support/support-products';

describe('createMockSupportPurchaseService', () => {
  it('loads the local mock products without a network request', async () => {
    const service = createMockSupportPurchaseService({ delayMs: 0 });

    await expect(service.loadProducts()).resolves.toEqual(MOCK_SUPPORT_PRODUCTS);
  });

  it('simulates unavailable products and product load failures', async () => {
    const unavailable = createMockSupportPurchaseService({
      delayMs: 0,
      loadOutcome: 'unavailable',
    });
    const failed = createMockSupportPurchaseService({
      delayMs: 0,
      loadOutcome: 'failure',
    });

    await expect(unavailable.loadProducts()).resolves.toEqual([]);
    await expect(failed.loadProducts()).rejects.toThrow('Mock product loading failed.');
  });

  it.each([
    ['success', { status: 'purchased' }],
    ['cancelled', { status: 'cancelled' }],
  ] as const)('simulates a %s purchase', async (purchaseOutcome, expectedResult) => {
    const service = createMockSupportPurchaseService({ delayMs: 0, purchaseOutcome });

    await expect(service.purchase('small_tip')).resolves.toEqual(expectedResult);
  });

  it('simulates a purchase failure', async () => {
    const service = createMockSupportPurchaseService({
      delayMs: 0,
      purchaseOutcome: 'failure',
    });

    await expect(service.purchase('small_tip')).rejects.toThrow('Mock purchase failed.');
  });
});
