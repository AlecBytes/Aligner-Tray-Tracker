import { MOCK_SUPPORT_PRODUCTS } from '@/features/support/support-products';
import type {
  SupportProduct,
  SupportPurchaseResult,
  SupportPurchaseService,
} from '@/features/support/support-purchase-service';

export type MockLoadOutcome = 'available' | 'failure' | 'unavailable';
export type MockPurchaseOutcome = 'cancelled' | 'failure' | 'success';

type MockSupportPurchaseServiceOptions = {
  delayMs?: number;
  loadOutcome?: MockLoadOutcome;
  products?: readonly SupportProduct[];
  purchaseOutcome?: MockPurchaseOutcome;
};

async function waitForLocalDelay(delayMs: number) {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export function createMockSupportPurchaseService({
  delayMs = 500,
  loadOutcome = 'available',
  products = MOCK_SUPPORT_PRODUCTS,
  purchaseOutcome = 'success',
}: MockSupportPurchaseServiceOptions = {}): SupportPurchaseService {
  return {
    async loadProducts() {
      await waitForLocalDelay(delayMs);

      if (loadOutcome === 'failure') {
        throw new Error('Mock product loading failed.');
      }

      return loadOutcome === 'unavailable' ? [] : [...products];
    },

    async purchase(productId: string): Promise<SupportPurchaseResult> {
      await waitForLocalDelay(delayMs);

      if (!products.some((product) => product.id === productId)) {
        throw new Error(`Unknown mock support product: ${productId}`);
      }

      if (purchaseOutcome === 'failure') {
        throw new Error('Mock purchase failed.');
      }

      return purchaseOutcome === 'cancelled'
        ? { status: 'cancelled' }
        : { status: 'purchased' };
    },
  };
}

export const mockSupportPurchaseService = createMockSupportPurchaseService();
