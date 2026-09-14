/** Orders snapshot reads against navigation and committed tracker mutations. */
export function createTrackerRefreshCoordinator<T, Context>(callbacks: {
  read: () => Promise<T>;
  start: () => void;
  accept: (value: T, context: Context | undefined) => void;
  fail: (context: Context | undefined) => void;
  settled: () => void;
}) {
  let active = false;
  let revision = 0;
  let mutating = false;
  let lastContext: Context | undefined;

  const isCurrent = (token: number) => active && token === revision;

  async function refresh(context?: Context) {
    // Mutation completion always performs one fresh read, coalescing requests here.
    if (!active || mutating) return;
    const token = ++revision;
    callbacks.start();
    try {
      const value = await callbacks.read();
      if (isCurrent(token)) callbacks.accept(value, context ?? lastContext);
    } catch {
      if (isCurrent(token)) callbacks.fail(context ?? lastContext);
    } finally {
      if (isCurrent(token)) callbacks.settled();
    }
  }

  return {
    refresh,
    isCurrent,
    activate() {
      active = true;
      return refresh();
    },
    deactivate() {
      active = false;
      revision += 1;
    },
    beginMutation() {
      if (!active || mutating) return null;
      mutating = true;
      lastContext = undefined;
      return ++revision;
    },
    async finishMutation(context?: Context) {
      lastContext = context;
      if (!active) {
        mutating = false;
        return;
      }

      const token = ++revision;
      callbacks.start();
      try {
        const value = await callbacks.read();
        if (isCurrent(token)) callbacks.accept(value, context);
      } catch {
        if (isCurrent(token)) callbacks.fail(context);
      } finally {
        mutating = false;
        if (isCurrent(token)) callbacks.settled();
      }
    },
  };
}
