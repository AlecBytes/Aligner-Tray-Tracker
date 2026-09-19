import Purchases from 'react-native-purchases';

import {
  configureRevenueCat,
  resetRevenueCatConfigurationForTests,
} from './revenuecat-configuration.ios';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { configure: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetRevenueCatConfigurationForTests();
});

it('configures RevenueCat once when services share the same key', () => {
  configureRevenueCat('appl_public');
  configureRevenueCat('appl_public');

  expect(Purchases.configure).toHaveBeenCalledTimes(1);
  expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_public' });
});

it('rejects a second, different key', () => {
  configureRevenueCat('appl_public');

  expect(() => configureRevenueCat('test_public')).toThrow(
    'RevenueCat is already configured with a different API key.',
  );
});
