import { resolvePaidAccessConfig } from './paid-access-config';
describe('paid access configuration', () => {
  it('accepts the development Test Store configuration', () => {
    const { env } = require('../../../eas.json').build.development;
    expect(resolvePaidAccessConfig(env)).toMatchObject({ mode: 'test-store', apiKey: 'test_biVNuNEpgMcBaWxsUrKvilcdDvi' });
  });
  it('disables mock and Test Store in production', () => { expect(resolvePaidAccessConfig({ APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'mock' }).mode).toBe('disabled'); expect(resolvePaidAccessConfig({ APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'test-store' }).mode).toBe('disabled'); });
  it('recognizes the runtime-visible production variant', () => expect(resolvePaidAccessConfig({ EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'mock' }).mode).toBe('disabled'));
  it('allows Apple production and explicit nonproduction modes', () => { expect(resolvePaidAccessConfig({ APP_VARIANT: 'production', EXPO_PUBLIC_PAID_ACCESS_MODE: 'apple', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_public' }).mode).toBe('apple'); expect(resolvePaidAccessConfig({ APP_VARIANT: 'development', EXPO_PUBLIC_PAID_ACCESS_MODE: 'mock' }).mode).toBe('mock'); });
  it('rejects a key from the wrong store environment', () => expect(resolvePaidAccessConfig({ EXPO_PUBLIC_PAID_ACCESS_MODE: 'apple', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'test_public' }).mode).toBe('disabled'));
  it('allows a production free-first build without forcing Apple paid access', () => {
    const priorVariant = process.env.APP_VARIANT;
    const priorMode = process.env.EXPO_PUBLIC_PAID_ACCESS_MODE;
    process.env.APP_VARIANT = 'production';
    delete process.env.EXPO_PUBLIC_PAID_ACCESS_MODE;

    try {
      const configModule = jest.requireActual('../../../app.config.js');
      const exportedConfig = configModule.default ?? configModule;
      const config = { config: { plugins: [], ios: {} } };
      expect(() => exportedConfig(config)).not.toThrow();
    } finally {
      if (priorVariant === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = priorVariant;
      if (priorMode === undefined) delete process.env.EXPO_PUBLIC_PAID_ACCESS_MODE; else process.env.EXPO_PUBLIC_PAID_ACCESS_MODE = priorMode;
    }
  });
});
