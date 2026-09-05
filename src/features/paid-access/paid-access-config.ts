export type PaidAccessMode = 'disabled' | 'mock' | 'test-store' | 'apple';
export type PaidAccessConfig = { apiKey?: string; mode: PaidAccessMode; privacyUrl?: string; termsUrl?: string };
export function resolvePaidAccessConfig(env: Record<string, string | undefined>): PaidAccessConfig {
  const requested = env.EXPO_PUBLIC_PAID_ACCESS_MODE;
  const production = (env.EXPO_PUBLIC_APP_VARIANT ?? env.APP_VARIANT) === 'production';
  const mode: PaidAccessMode = requested === 'mock' || requested === 'test-store' || requested === 'apple' ? requested : 'disabled';
  const apiKey = env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || undefined;
  const environmentMatchesKey = mode === 'disabled' || mode === 'mock' || (mode === 'test-store' && apiKey?.startsWith('test_')) || (mode === 'apple' && apiKey?.startsWith('appl_'));
  const safeMode = (production && mode !== 'apple') || !environmentMatchesKey ? 'disabled' : mode;
  return { mode: safeMode, apiKey, termsUrl: env.EXPO_PUBLIC_TERMS_URL?.trim() || undefined, privacyUrl: env.EXPO_PUBLIC_PRIVACY_URL?.trim() || undefined };
}
export const paidAccessConfig = resolvePaidAccessConfig({
  APP_VARIANT: process.env.APP_VARIANT,
  EXPO_PUBLIC_APP_VARIANT: process.env.EXPO_PUBLIC_APP_VARIANT,
  EXPO_PUBLIC_PAID_ACCESS_MODE: process.env.EXPO_PUBLIC_PAID_ACCESS_MODE,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
});
