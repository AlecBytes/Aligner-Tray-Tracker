import { resolveReleaseFeatures } from './release-features';

describe('release feature configuration', () => {
  it('disables paid access and cloud backup for the free-first production build', () => {
    expect(
      resolveReleaseFeatures({
        EXPO_PUBLIC_APP_VARIANT: 'production',
        EXPO_PUBLIC_CLOUD_BACKUP_MODE: 'disabled',
        EXPO_PUBLIC_PAID_ACCESS_MODE: 'disabled',
      }),
    ).toEqual({ cloudBackup: false, paidAccess: false });
  });

  it('keeps features available in development unless explicitly disabled', () => {
    expect(resolveReleaseFeatures({ APP_VARIANT: 'development' })).toEqual({
      cloudBackup: true,
      paidAccess: true,
    });
    expect(
      resolveReleaseFeatures({
        APP_VARIANT: 'development',
        EXPO_PUBLIC_CLOUD_BACKUP_MODE: 'disabled',
        EXPO_PUBLIC_PAID_ACCESS_MODE: 'disabled',
      }),
    ).toEqual({ cloudBackup: false, paidAccess: false });
  });

  it('requires explicit production enablement for future releases', () => {
    expect(
      resolveReleaseFeatures({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_CLOUD_BACKUP_MODE: 'enabled',
        EXPO_PUBLIC_PAID_ACCESS_MODE: 'apple',
      }),
    ).toEqual({ cloudBackup: true, paidAccess: true });
  });
});
