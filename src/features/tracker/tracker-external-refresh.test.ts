import { subscribeToTrackerExternalChanges } from '@/features/tracker/tracker-external-refresh';

describe('tracker external refresh lifecycle', () => {
  it('refreshes for native mutations and when the app becomes active', () => {
    const refresh = jest.fn();
    const removeWearStatusListener = jest.fn();
    const removeAppStateListener = jest.fn();
    let wearStatusListener: (() => void) | undefined;
    let appStateListener: ((state: string) => void) | undefined;

    const subscription = subscribeToTrackerExternalChanges({
      addWearStatusListener(listener) {
        wearStatusListener = listener;
        return { remove: removeWearStatusListener };
      },
      appState: {
        addEventListener(_event, listener) {
          appStateListener = listener;
          return { remove: removeAppStateListener };
        },
      },
      refresh,
    });

    wearStatusListener?.();
    appStateListener?.('background');
    appStateListener?.('active');

    expect(refresh).toHaveBeenCalledTimes(2);

    subscription.remove();
    expect(removeWearStatusListener).toHaveBeenCalledTimes(1);
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
  });
});
