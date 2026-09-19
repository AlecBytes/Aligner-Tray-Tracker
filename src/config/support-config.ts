export type SupportMode = 'apple' | 'disabled' | 'mock';
export type SupportConfig = { apiKey?: string; mode: SupportMode };

export function resolveSupportConfig(
  env: Record<string, string | undefined>,
): SupportConfig {
  const requestedMode = env.EXPO_PUBLIC_SUPPORT_MODE;
  const apiKey = env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || undefined;

  if (requestedMode === 'mock') {
    return { apiKey, mode: 'mock' };
  }

  if (requestedMode === 'apple' && apiKey?.startsWith('appl_')) {
    return { apiKey, mode: 'apple' };
  }

  return { apiKey, mode: 'disabled' };
}

export const supportConfig = resolveSupportConfig({
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  EXPO_PUBLIC_SUPPORT_MODE: process.env.EXPO_PUBLIC_SUPPORT_MODE,
});
export const supportMode = supportConfig.mode;
export const isSupportEnabled = supportConfig.mode !== 'disabled';
