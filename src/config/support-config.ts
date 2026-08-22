export type SupportMode = 'disabled' | 'mock';

export function resolveSupportMode(configuredMode: string | undefined): SupportMode {
  return configuredMode === 'mock' ? 'mock' : 'disabled';
}

export const supportMode = resolveSupportMode(process.env.EXPO_PUBLIC_SUPPORT_MODE);
export const isSupportEnabled = supportMode !== 'disabled';
