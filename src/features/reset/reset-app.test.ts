import { resetAppWithLocalSession } from '@/features/reset/reset-app';

describe('reset app with local session', () => {
  it('clears local credentials before resetting SQLite', async () => {
    const order: string[] = [];

    await resetAppWithLocalSession({
      clearLocalSession: jest.fn(async () => {
        order.push('auth');
      }),
      resetLocalData: jest.fn(async () => {
        order.push('sqlite');
      }),
      reconcileNotifications: jest.fn(async () => {
        order.push('notifications');
      }),
    });

    expect(order).toEqual(['auth', 'sqlite', 'notifications']);
  });

  it('aborts before SQLite when secure credentials cannot be cleared', async () => {
    const resetLocalData = jest.fn(async () => undefined);
    const reconcileNotifications = jest.fn(async () => undefined);

    await expect(
      resetAppWithLocalSession({
        clearLocalSession: jest.fn(async () => {
          throw new Error('Keychain unavailable');
        }),
        resetLocalData,
        reconcileNotifications,
      }),
    ).rejects.toThrow('Keychain unavailable');

    expect(resetLocalData).not.toHaveBeenCalled();
    expect(reconcileNotifications).not.toHaveBeenCalled();
  });
});
