import type { SupportProduct } from '@/features/support/support-purchase-service';
import { supportReducer, type SupportState } from '@/features/support/support-state';

const products: readonly SupportProduct[] = [
  { displayPrice: '$1.99', id: 'small_tip', title: 'Small Tip' },
];

describe('supportReducer', () => {
  it('moves from loading to products available', () => {
    expect(
      supportReducer({ status: 'loading' }, { products, type: 'load-succeeded' }),
    ).toEqual({ products, status: 'products-available' });
  });

  it('treats an empty product list or load failure as products unavailable', () => {
    expect(
      supportReducer({ status: 'loading' }, { products: [], type: 'load-succeeded' }),
    ).toEqual({ status: 'products-unavailable' });
    expect(supportReducer({ status: 'loading' }, { type: 'load-failed' })).toEqual({
      status: 'products-unavailable',
    });
  });

  it('tracks a purchase in progress and its successful thank-you state', () => {
    const available: SupportState = { products, status: 'products-available' };
    const purchasing = supportReducer(available, {
      productId: 'small_tip',
      type: 'purchase-started',
    });

    expect(purchasing).toEqual({
      productId: 'small_tip',
      products,
      status: 'purchase-in-progress',
    });
    expect(supportReducer(purchasing, { type: 'purchase-succeeded' })).toEqual({
      productId: 'small_tip',
      products,
      status: 'purchase-successful',
    });
  });

  it.each([
    ['purchase-cancelled', 'purchase-cancelled'],
    ['purchase-failed', 'purchase-failed'],
  ] as const)('moves to %s while preserving products', (actionType, expectedStatus) => {
    const purchasing: SupportState = {
      productId: 'small_tip',
      products,
      status: 'purchase-in-progress',
    };

    expect(supportReducer(purchasing, { type: actionType })).toEqual({
      products,
      status: expectedStatus,
    });
  });

  it('allows another purchase after cancellation or failure', () => {
    for (const status of ['purchase-cancelled', 'purchase-failed'] as const) {
      expect(
        supportReducer(
          { products, status },
          { productId: 'small_tip', type: 'purchase-started' },
        ),
      ).toEqual({
        productId: 'small_tip',
        products,
        status: 'purchase-in-progress',
      });
    }
  });
});
