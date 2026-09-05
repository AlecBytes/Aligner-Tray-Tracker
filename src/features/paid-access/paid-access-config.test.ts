import { resolvePaidAccessConfig } from './paid-access-config';
describe('paid access configuration', () => {
  it('disables mock and Test Store in production', () => { expect(resolvePaidAccessConfig({ APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'mock' }).mode).toBe('disabled'); expect(resolvePaidAccessConfig({ APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'test-store' }).mode).toBe('disabled'); });
  it('recognizes the runtime-visible production variant', () => expect(resolvePaidAccessConfig({ EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'mock' }).mode).toBe('disabled'));
  it('allows Apple production and explicit nonproduction modes', () => { expect(resolvePaidAccessConfig({ APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'apple', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_public' }).mode).toBe('apple'); expect(resolvePaidAccessConfig({ APP_VARIANT: 'development', EXPO_PUBLIC_PAID_ACCESS_MODE: 'mock' }).mode).toBe('mock'); });
  it('rejects a key from the wrong store environment', () => expect(resolvePaidAccessConfig({ EXPO_PUBLIC_PAID_ACCESS_MODE: 'apple', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'test_public' }).mode).toBe('disabled'));
});
