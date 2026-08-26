import { reconcileNotificationsForPlatform } from '@/features/notifications/notification-routing';

describe('notification reconciliation routing', () => {
  it('uses the native coordinator on iOS', async () => {
    const reconcileNative = jest.fn(async () => true);
    const reconcileExpo = jest.fn(async () => undefined);

    await reconcileNotificationsForPlatform('ios', true, reconcileNative, reconcileExpo);

    expect(reconcileNative).toHaveBeenCalledTimes(1);
    expect(reconcileExpo).not.toHaveBeenCalled();
  });

  it('keeps the Expo implementation on Android', async () => {
    const reconcileNative = jest.fn(async () => true);
    const reconcileExpo = jest.fn(async () => undefined);

    await reconcileNotificationsForPlatform('android', true, reconcileNative, reconcileExpo);

    expect(reconcileExpo).toHaveBeenCalledTimes(1);
    expect(reconcileNative).not.toHaveBeenCalled();
  });

  it('uses the existing Expo path when the local iOS module is unavailable', async () => {
    const reconcileNative = jest.fn(async () => true);
    const reconcileExpo = jest.fn(async () => undefined);

    await reconcileNotificationsForPlatform('ios', false, reconcileNative, reconcileExpo);

    expect(reconcileExpo).toHaveBeenCalledTimes(1);
    expect(reconcileNative).not.toHaveBeenCalled();
  });
});
