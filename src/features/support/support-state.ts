import type { SupportProduct } from '@/features/support/support-purchase-service';

export type SupportState =
  | { status: 'loading' }
  | { status: 'products-unavailable' }
  | { products: readonly SupportProduct[]; status: 'products-available' }
  | {
      productId: string;
      products: readonly SupportProduct[];
      status: 'purchase-in-progress';
    }
  | {
      productId: string;
      products: readonly SupportProduct[];
      status: 'purchase-successful';
    }
  | { products: readonly SupportProduct[]; status: 'purchase-cancelled' }
  | { products: readonly SupportProduct[]; status: 'purchase-failed' };

export type SupportAction =
  | { type: 'load-started' }
  | { products: readonly SupportProduct[]; type: 'load-succeeded' }
  | { type: 'load-failed' }
  | { productId: string; type: 'purchase-started' }
  | { type: 'purchase-succeeded' }
  | { type: 'purchase-cancelled' }
  | { type: 'purchase-failed' }
  | { type: 'support-again' };

function hasPurchasableProducts(
  state: SupportState,
): state is Extract<SupportState, { products: readonly SupportProduct[] }> {
  return 'products' in state && state.status !== 'purchase-in-progress';
}

export function supportReducer(state: SupportState, action: SupportAction): SupportState {
  switch (action.type) {
    case 'load-started':
      return { status: 'loading' };
    case 'load-succeeded':
      return action.products.length === 0
        ? { status: 'products-unavailable' }
        : { products: action.products, status: 'products-available' };
    case 'load-failed':
      return { status: 'products-unavailable' };
    case 'purchase-started':
      return hasPurchasableProducts(state)
        ? {
            productId: action.productId,
            products: state.products,
            status: 'purchase-in-progress',
          }
        : state;
    case 'purchase-succeeded':
      return state.status === 'purchase-in-progress'
        ? {
            productId: state.productId,
            products: state.products,
            status: 'purchase-successful',
          }
        : state;
    case 'purchase-cancelled':
      return state.status === 'purchase-in-progress'
        ? { products: state.products, status: 'purchase-cancelled' }
        : state;
    case 'purchase-failed':
      return state.status === 'purchase-in-progress'
        ? { products: state.products, status: 'purchase-failed' }
        : state;
    case 'support-again':
      return state.status === 'purchase-successful'
        ? { products: state.products, status: 'products-available' }
        : state;
  }
}
