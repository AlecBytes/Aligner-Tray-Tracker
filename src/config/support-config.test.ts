import { resolveSupportConfig } from '@/config/support-config';

describe('resolveSupportConfig', () => {
  it('enables the mock Support experience without requiring a key', () => {
    expect(resolveSupportConfig({ EXPO_PUBLIC_SUPPORT_MODE: 'mock' })).toEqual({
      apiKey: undefined,
      mode: 'mock',
    });
  });

  it('enables Apple Support only with an Apple public SDK key', () => {
    expect(resolveSupportConfig({
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: ' appl_public ',
      EXPO_PUBLIC_SUPPORT_MODE: 'apple',
    })).toEqual({ apiKey: 'appl_public', mode: 'apple' });
  });

  it.each([undefined, '', 'test_public', 'goog_public'])(
    'fails closed for Apple mode with key %p',
    (apiKey) => {
      expect(resolveSupportConfig({
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: apiKey,
        EXPO_PUBLIC_SUPPORT_MODE: 'apple',
      })).toEqual({ apiKey: apiKey || undefined, mode: 'disabled' });
    },
  );

  it.each([undefined, 'disabled', 'production', 'MOCK', ''])('disables Support for %p', (mode) => {
    expect(resolveSupportConfig({ EXPO_PUBLIC_SUPPORT_MODE: mode })).toEqual({
      apiKey: undefined,
      mode: 'disabled',
    });
  });
});
