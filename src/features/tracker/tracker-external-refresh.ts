type Subscription = { remove(): void };

type AppStateSource = {
  addEventListener(
    event: 'change',
    listener: (state: string) => void,
  ): Subscription;
};

export function subscribeToTrackerExternalChanges({
  addWearStatusListener,
  appState,
  refresh,
}: {
  addWearStatusListener: (listener: () => void) => Subscription;
  appState: AppStateSource;
  refresh: () => void;
}) {
  const wearStatusSubscription = addWearStatusListener(refresh);
  const appStateSubscription = appState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      refresh();
    }
  });

  return {
    remove() {
      wearStatusSubscription.remove();
      appStateSubscription.remove();
    },
  };
}
