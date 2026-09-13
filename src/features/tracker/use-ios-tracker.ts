import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import {
  addWearStatusChangedListener,
  ensureWearStatus,
  isNativeWearStatusAvailable,
  refreshWatchTrackerSnapshot,
} from '@/features/siri/aligner-tracker-intents';
import { createTrackerReadModel, getLatestWearPunch } from './tracker-calculations';
import { subscribeToTrackerExternalChanges } from './tracker-external-refresh';
import {
  applyTrackerRedo,
  applyTrackerUndo,
  getTrackerSessionHistory,
  rememberTrackerRedo,
  rememberTrackerToggle,
  rememberTrackerUndo,
  validateTrackerSessionHistory,
} from './tracker-history-session';
import type { TrackerSnapshot } from './tracker-model';
import { createTrackerRefreshCoordinator } from './tracker-refresh-coordinator';
import {
  getTrackerSnapshot,
  redoWearStatus,
  toggleWearStatus,
  undoWearStatus,
} from './tracker-repository';

type RefreshContext = { saved?: boolean; message?: string };
const NO_TREATMENT = 'No active treatment was found. Complete treatment setup first.';

export function useIOSTracker() {
  const db = useSQLiteContext();
  const mounted = useRef(true);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [history, setHistory] = useState(getTrackerSessionHistory);
  const [now, setNow] = useState(Date.now);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRetry, setNeedsRetry] = useState(false);
  const read = useCallback(async () => {
    const readAt = Date.now();
    return { persistedSnapshot: await getTrackerSnapshot(db, readAt), readAt };
  }, [db]);

  const coordinator = useMemo(
    () => createTrackerRefreshCoordinator({
      read,
      start() {
        setIsLoading(true);
      },
      accept({ persistedSnapshot, readAt }, context: RefreshContext | undefined) {
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
        setNeedsRetry(false);
        setError(persistedSnapshot === null ? NO_TREATMENT : context?.message ?? null);
      },
      fail(context: RefreshContext | undefined) {
        const message = context?.saved
          ? 'Tracker saved, but the latest state could not be loaded. The displayed state may be outdated. Please retry.'
          : 'The saved tracker could not be loaded. The displayed state may be outdated. Please retry.';
        setError(context?.message ? `${context.message} ${message}` : message);
        setNeedsRetry(true);
      },
      settled() {
        setIsLoading(false);
      },
    }),
    [read],
  );

  useEffect(() => {
    mounted.current = true;
    const subscription = subscribeToTrackerExternalChanges({
      addWearStatusListener: addWearStatusChangedListener,
      appState: AppState,
      refresh() {
        void coordinator.refresh();
      },
    });
    return () => {
      mounted.current = false;
      coordinator.deactivate();
      subscription.remove();
    };
  }, [coordinator]);

  useFocusEffect(
    useCallback(() => {
      void coordinator.activate();
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        coordinator.deactivate();
        clearInterval(timer);
      };
    }, [coordinator]),
  );

  async function mutate(kind: 'toggle' | 'undo' | 'redo') {
    if (snapshot === null || needsRetry || isLoading) return;
    const latestPunch = getLatestWearPunch(snapshot.punches);
    const action = kind === 'undo' ? history.undoAction : history.redoAction;
    if (kind === 'toggle' ? latestPunch === null : action === null) return;
    const token = coordinator.beginMutation();
    if (token === null) return;
    setIsMutating(true);
    setError(null);
    let context: RefreshContext = {};
    try {
      const timestamp = Date.now();
      if (kind === 'toggle' && latestPunch !== null) {
        const status = createTrackerReadModel(snapshot, timestamp).currentStatus;
        const native = isNativeWearStatusAvailable();
        const result = native
          ? await ensureWearStatus(status === 'IN' ? 'OUT' : 'IN', timestamp)
          : {
              outcome: 'changed' as const,
              notificationStatus: 'not-needed' as const,
              punch: await toggleWearStatus(db, snapshot.trayPeriodId, status, timestamp),
            };
        if (result.outcome === 'no-active-treatment') {
          context = { message: NO_TREATMENT };
          if (coordinator.isCurrent(token)) {
            setSnapshot(null);
            setHistory(validateTrackerSessionHistory(null));
          }
        } else if (result.outcome === 'changed') {
          context = {
            saved: true,
            message: result.notificationStatus === 'failed'
              ? 'Tracker saved, but reminders could not be refreshed.'
              : undefined,
          };
          if (coordinator.isCurrent(token)) {
            setSnapshot((current) =>
              current === null || current.trayPeriodId !== snapshot.trayPeriodId
                ? current
                : {
                    ...current,
                    punches: [
                      ...current.punches.filter((punch) => punch.id !== result.punch.id),
                      result.punch,
                    ],
                  },
            );
            setHistory(rememberTrackerToggle({
              predecessor: latestPunch,
              punch: result.punch,
              trayPeriodId: snapshot.trayPeriodId,
            }));
            setNow(timestamp);
          }
          if (!native) void reconcileLocalNotifications(db);
        }
        // already-in-state is a successful no-op; the readback validates history.
      } else if (action !== null) {
        if (kind === 'undo') {
          await undoWearStatus(db, action);
          if (coordinator.isCurrent(token)) {
            setSnapshot((current) => current === null ? current : applyTrackerUndo(current, action));
            setHistory(rememberTrackerUndo(action));
          }
        } else {
          const punch = await redoWearStatus(db, action);
          if (coordinator.isCurrent(token)) {
            setSnapshot((current) => current === null ? current : applyTrackerRedo(current, punch));
            setHistory(rememberTrackerRedo(punch));
          }
        }
        context = { saved: true };
        void reconcileLocalNotifications(db);
        void refreshWatchTrackerSnapshot();
      }
    } catch {
      context = {
        message: kind === 'toggle'
          ? 'The tracker could not be updated.'
          : `The tracker change could not be ${kind === 'undo' ? 'undone' : 'redone'}.`,
      };
    } finally {
      // Release the mutation lock and read once, including any deferred refreshes.
      const readback = coordinator.finishMutation(context);
      if (mounted.current) setIsMutating(false);
      await readback;
    }
  }

  return {
    snapshot, history, now, isLoading, isMutating, error, needsRetry,
    actionsDisabled: isLoading || isMutating || needsRetry,
    refreshTracker: () => coordinator.refresh(),
    toggleTracker: () => mutate('toggle'),
    undoTracker: () => mutate('undo'),
    redoTracker: () => mutate('redo'),
  };
}
