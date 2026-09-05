import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { createRevenueCatPaidAccessService } from './revenuecat-paid-access-service.ios';
import { NO_PAID_ACCESS } from './paid-access-service';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(), getCustomerInfo: jest.fn(), getOfferings: jest.fn(),
    purchasePackage: jest.fn(), restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(), removeCustomerInfoUpdateListener: jest.fn(),
  },
  PURCHASES_ERROR_CODE: {},
}));

const customer = (identifier = 'aligner_tray_tracker_pro') => ({
  entitlements: { active: { [identifier]: { isActive: true, expirationDateMillis: null, productIdentifier: 'lifetime' } } },
  activeSubscriptions: [],
}) as unknown as CustomerInfo;
const packages = ['MONTHLY', 'ANNUAL', 'LIFETIME'].map((packageType) => ({
  identifier: packageType, packageType, product: { priceString: '$1.00' },
}));

beforeEach(() => jest.clearAllMocks());

it('reads the app entitlement and does not grant access for the old premium identifier', async () => {
  const service = createRevenueCatPaidAccessService('test_public');
  jest.mocked(Purchases.getCustomerInfo).mockResolvedValueOnce(customer()).mockResolvedValueOnce(customer('premium'));
  expect(await service.getAccess()).toEqual({ hasPremiumAccess: true, isLifetime: true, expirationAt: null });
  expect(await service.getAccess()).toEqual(NO_PAID_ACCESS);
  expect(Purchases.configure).toHaveBeenCalledTimes(1);
});

it('keeps the premium offering and uses the new entitlement for purchase, restore, and updates', async () => {
  const service = createRevenueCatPaidAccessService('test_public');
  jest.mocked(Purchases.getOfferings).mockResolvedValue({ all: { premium: { availablePackages: packages } }, current: null } as unknown as Awaited<ReturnType<typeof Purchases.getOfferings>>);
  expect((await service.loadPackages()).map((item) => item.kind)).toEqual(['monthly', 'annual', 'lifetime']);
  jest.mocked(Purchases.purchasePackage).mockResolvedValue({ customerInfo: customer() } as Awaited<ReturnType<typeof Purchases.purchasePackage>>);
  expect((await service.purchase('LIFETIME')).outcome).toBe('purchased');
  jest.mocked(Purchases.restorePurchases).mockResolvedValue(customer());
  expect((await service.restore()).isLifetime).toBe(true);
  const listener = jest.fn();
  const unsubscribe = service.subscribe(listener);
  const callback = jest.mocked(Purchases.addCustomerInfoUpdateListener).mock.calls[0][0];
  callback(customer());
  expect(listener).toHaveBeenLastCalledWith({ hasPremiumAccess: true, isLifetime: true, expirationAt: null });
  callback(customer('premium'));
  expect(listener).toHaveBeenLastCalledWith(NO_PAID_ACCESS);
  unsubscribe();
  expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(callback);
});
