import Purchases, {
  PRODUCT_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';

import { resetRevenueCatConfigurationForTests } from '@/features/purchases/revenuecat-configuration.ios';
import { createRevenueCatSupportPurchaseService } from './revenuecat-support-purchase-service.ios';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
  },
  PURCHASES_ERROR_CODE: {
    PAYMENT_PENDING_ERROR: 'PAYMENT_PENDING_ERROR',
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
  },
  PRODUCT_TYPE: {
    CONSUMABLE: 'CONSUMABLE',
    NON_CONSUMABLE: 'NON_CONSUMABLE',
  },
}));

const packages = [
  {
    identifier: 'small_tip',
    product: {
      identifier: 'com.alecsbytes.alignertraytracker.tip.small',
      priceString: 'US$1.99',
      productType: PRODUCT_TYPE.CONSUMABLE,
    },
  },
  {
    identifier: 'supporter_tip',
    product: {
      identifier: 'com.alecsbytes.alignertraytracker.tip.supporter',
      priceString: 'US$4.99',
      productType: PRODUCT_TYPE.CONSUMABLE,
    },
  },
  {
    identifier: 'big_tip',
    product: {
      identifier: 'com.alecsbytes.alignertraytracker.tip.big',
      priceString: 'US$9.99',
      productType: PRODUCT_TYPE.CONSUMABLE,
    },
  },
] as unknown as PurchasesPackage[];

function offerings(availablePackages: PurchasesPackage[] = packages, identifier = 'support') {
  return {
    all: { [identifier]: { availablePackages } },
    current: null,
  } as unknown as Awaited<ReturnType<typeof Purchases.getOfferings>>;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRevenueCatConfigurationForTests();
});

it('loads the strict Support offering in product order with localized prices', async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offerings([...packages].reverse()));
  const service = createRevenueCatSupportPurchaseService('appl_public');

  await expect(service.loadProducts()).resolves.toEqual([
    { displayPrice: 'US$1.99', id: 'small_tip', title: 'Small Tip' },
    { displayPrice: 'US$4.99', id: 'supporter_tip', title: 'Supporter Tip' },
    { displayPrice: 'US$9.99', id: 'big_tip', title: 'Big Tip' },
  ]);
  expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_public' });
});

it.each([
  ['a missing offering', offerings([], 'other')],
  ['a partial catalog', offerings(packages.slice(0, 2))],
  ['an unexpected package', offerings([{ ...packages[0], identifier: 'other' }, ...packages.slice(1)])],
  ['a mismatched store product', offerings([{ ...packages[0], product: { ...packages[0].product, identifier: 'wrong' } }, ...packages.slice(1)])],
  ['a non-consumable store product', offerings([{ ...packages[0], product: { ...packages[0].product, productType: PRODUCT_TYPE.NON_CONSUMABLE } }, ...packages.slice(1)])],
])('fails closed for %s', async (_label, catalog) => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(catalog);
  const service = createRevenueCatSupportPurchaseService('appl_public');

  await expect(service.loadProducts()).resolves.toEqual([]);
  await expect(service.purchase('small_tip')).rejects.toThrow('Support product is unavailable.');
});

it('purchases a loaded consumable and permits repeated purchases', async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offerings());
  jest.mocked(Purchases.purchasePackage).mockResolvedValue({} as never);
  const service = createRevenueCatSupportPurchaseService('appl_public');
  await service.loadProducts();

  await expect(service.purchase('small_tip')).resolves.toEqual({ status: 'purchased' });
  await expect(service.purchase('small_tip')).resolves.toEqual({ status: 'purchased' });
  expect(Purchases.purchasePackage).toHaveBeenCalledTimes(2);
});

it('returns cancellation without presenting it as a failure', async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offerings());
  jest.mocked(Purchases.purchasePackage).mockRejectedValue({
    code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
  });
  const service = createRevenueCatSupportPurchaseService('appl_public');
  await service.loadProducts();

  await expect(service.purchase('supporter_tip')).resolves.toEqual({ status: 'cancelled' });
});

it.each([
  ['pending', { code: PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR }],
  ['failure', new Error('Store unavailable')],
])('surfaces %s as a retryable failure', async (_label, error) => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offerings());
  jest.mocked(Purchases.purchasePackage).mockRejectedValue(error);
  const service = createRevenueCatSupportPurchaseService('appl_public');
  await service.loadProducts();

  await expect(service.purchase('big_tip')).rejects.toBe(error);
});
