import Purchases, {
  PURCHASES_ERROR_CODE,
  PRODUCT_TYPE,
  type PurchasesPackage,
} from 'react-native-purchases';

import { configureRevenueCat } from '@/features/purchases/revenuecat-configuration.ios';
import type {
  SupportProduct,
  SupportPurchaseService,
} from '@/features/support/support-purchase-service';

const SUPPORT_OFFERING_IDENTIFIER = 'support';
const SUPPORT_CATALOG = [
  {
    packageId: 'small_tip',
    productId: 'com.alecsbytes.alignertraytracker.tip.small',
    title: 'Small Tip',
  },
  {
    packageId: 'supporter_tip',
    productId: 'com.alecsbytes.alignertraytracker.tip.supporter',
    title: 'Supporter Tip',
  },
  {
    packageId: 'big_tip',
    productId: 'com.alecsbytes.alignertraytracker.tip.big',
    title: 'Big Tip',
  },
] as const;

export function createRevenueCatSupportPurchaseService(
  apiKey: string,
): SupportPurchaseService {
  const packageCache = new Map<string, PurchasesPackage>();

  return {
    async loadProducts(): Promise<readonly SupportProduct[]> {
      configureRevenueCat(apiKey);
      const offering = (await Purchases.getOfferings()).all[SUPPORT_OFFERING_IDENTIFIER];
      const availablePackages = offering?.availablePackages ?? [];
      packageCache.clear();

      if (availablePackages.length !== SUPPORT_CATALOG.length) {
        return [];
      }

      const products = SUPPORT_CATALOG.flatMap((expected) => {
        const item = availablePackages.find(
          (candidate) =>
            candidate.identifier === expected.packageId &&
            candidate.product.identifier === expected.productId &&
            candidate.product.productType === PRODUCT_TYPE.CONSUMABLE,
        );

        if (!item) {
          return [];
        }

        packageCache.set(expected.packageId, item);
        return [{
          displayPrice: item.product.priceString,
          id: expected.packageId,
          title: expected.title,
        }];
      });

      if (products.length !== SUPPORT_CATALOG.length) {
        packageCache.clear();
        return [];
      }

      return products;
    },

    async purchase(productId) {
      const item = packageCache.get(productId);
      if (!item) {
        throw new Error('Support product is unavailable.');
      }

      try {
        await Purchases.purchasePackage(item);
        return { status: 'purchased' };
      } catch (error) {
        if ((error as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          return { status: 'cancelled' };
        }

        throw error;
      }
    },
  };
}
