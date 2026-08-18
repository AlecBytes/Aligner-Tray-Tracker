export type SupportProduct = {
  displayPrice: string;
  id: string;
  title: string;
};

export type SupportPurchaseResult =
  | { status: 'cancelled' }
  | { status: 'purchased' };

export interface SupportPurchaseService {
  loadProducts(): Promise<readonly SupportProduct[]>;
  purchase(productId: string): Promise<SupportPurchaseResult>;
}
