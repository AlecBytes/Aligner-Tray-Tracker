export type ReleaseFeatures = {
  cloudBackup: boolean;
  paidAccess: boolean;
};

export function resolveReleaseFeatures(
  env: Record<string, string | undefined>,
): ReleaseFeatures {
  const production = (env.EXPO_PUBLIC_APP_VARIANT ?? env.APP_VARIANT) === 'production';

  return {
    cloudBackup:
      env.EXPO_PUBLIC_CLOUD_BACKUP_MODE === 'enabled' ||
      (!production && env.EXPO_PUBLIC_CLOUD_BACKUP_MODE !== 'disabled'),
    paidAccess:
      env.EXPO_PUBLIC_PAID_ACCESS_MODE !== 'disabled' &&
      (!production || env.EXPO_PUBLIC_PAID_ACCESS_MODE === 'apple'),
  };
}

export const releaseFeatures = resolveReleaseFeatures({
  APP_VARIANT: process.env.APP_VARIANT,
  EXPO_PUBLIC_APP_VARIANT: process.env.EXPO_PUBLIC_APP_VARIANT,
  EXPO_PUBLIC_CLOUD_BACKUP_MODE: process.env.EXPO_PUBLIC_CLOUD_BACKUP_MODE,
  EXPO_PUBLIC_PAID_ACCESS_MODE: process.env.EXPO_PUBLIC_PAID_ACCESS_MODE,
});
