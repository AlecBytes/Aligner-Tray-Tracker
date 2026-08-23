type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

type RefreshClient = {
  auth: {
    startAutoRefresh(): void;
    stopAutoRefresh(): void;
  };
};

type AppStateLike = {
  currentState: AppStateStatus;
  addEventListener(
    event: 'change',
    listener: (state: AppStateStatus) => void,
  ): { remove(): void };
};

export function createCloudAuthLifecycle(input: {
  appState: AppStateLike;
  getClient: () => Promise<RefreshClient | null>;
}) {
  let cleanup: (() => void) | null = null;
  let startPromise: Promise<() => void> | null = null;
  let references = 0;

  async function start() {
    references += 1;

    if (!startPromise) {
      startPromise = (async () => {
        const client = await input.getClient();
        if (!client) {
          cleanup = () => {
            cleanup = null;
            startPromise = null;
          };
          return cleanup;
        }

        let isActive = false;
        const update = (state: AppStateStatus) => {
          const nextIsActive = state === 'active';
          if (nextIsActive === isActive) return;
          isActive = nextIsActive;
          if (isActive) client.auth.startAutoRefresh();
          else client.auth.stopAutoRefresh();
        };

        update(input.appState.currentState);
        const subscription = input.appState.addEventListener('change', update);
        cleanup = () => {
          subscription.remove();
          client.auth.stopAutoRefresh();
          cleanup = null;
          startPromise = null;
        };
        return cleanup;
      })().catch((error) => {
        startPromise = null;
        throw error;
      });
    }

    try {
      await startPromise;
    } catch (error) {
      references = Math.max(0, references - 1);
      throw error;
    }
    let released = false;

    return () => {
      if (released) return;
      released = true;
      references = Math.max(0, references - 1);
      if (references === 0) cleanup?.();
    };
  }

  function stop() {
    references = 0;
    cleanup?.();
  }

  return { start, stop };
}
