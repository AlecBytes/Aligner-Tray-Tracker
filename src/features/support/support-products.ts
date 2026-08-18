import type { SupportProduct } from '@/features/support/support-purchase-service';

export const MOCK_SUPPORT_PRODUCTS: readonly SupportProduct[] = [
  {
    displayPrice: '$1.99',
    id: 'small_tip',
    title: 'Small Tip',
  },
  {
    displayPrice: '$4.99',
    id: 'supporter_tip',
    title: 'Supporter Tip',
  },
  {
    displayPrice: '$9.99',
    id: 'big_tip',
    title: 'Big Tip',
  },
] as const;
